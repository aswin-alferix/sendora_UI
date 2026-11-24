import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCollection } from "@/lib/mongo/client";
import { COLLECTIONS, EmailDoc, ContactDoc, SignatureDoc } from "@/lib/mongo/schema";
import { getUserIdFromRequest } from "@/lib/mongo/user";
import { buildPersonalizationContext, substitute, appendSignatureIfMissing } from "@/lib/mail/substitute";

export const dynamic = "force-dynamic";

type ProviderId = "resend" | "sendgrid" | "ses";

interface SendRequest {
    provider: ProviderId;
    apiKey?: string;
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    awsRegion?: string;
    fromName: string;
    fromEmail: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    html: string;
    /** ISO timestamp for scheduled send. */
    scheduledAt?: string;
    /**
     * If true and `to` has multiple recipients, send N individually-personalized emails
     * (mail-merge style) — each recipient sees only their own copy. cc/bcc are ignored
     * in this mode since they don't make sense per recipient.
     */
    sendSeparately?: boolean;
    /** User-supplied values for non-auto placeholders (e.g. { "Start Date": "Jun 3 2025" }) */
    customVariables?: Record<string, string>;
}

interface ProviderResult {
    ok: boolean;
    status: number;
    id?: string;
    error?: string;
}

function fromHeader(name: string, email: string) {
    return name ? `${name} <${email}>` : email;
}

function htmlToPreview(html: string, max = 200): string {
    return html
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max);
}

async function logEmail(doc: EmailDoc) {
    try {
        const col = await getCollection<EmailDoc>(COLLECTIONS.emails);
        await col.insertOne(doc);
    } catch (err) {
        console.error("[send] failed to log email", err);
    }
}

/** Send a single (already-substituted) email through the chosen provider. */
async function callProvider(args: {
    provider: ProviderId;
    apiKey?: string;
    fromName: string;
    fromEmail: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    html: string;
    scheduledAtIso?: string;
}): Promise<ProviderResult> {
    if (args.provider === "resend") {
        if (!args.apiKey) return { ok: false, status: 400, error: "Resend API key is missing" };
        const payload: Record<string, unknown> = {
            from: fromHeader(args.fromName, args.fromEmail),
            to: args.to,
            subject: args.subject,
            html: args.html,
        };
        if (args.cc?.length) payload.cc = args.cc;
        if (args.bcc?.length) payload.bcc = args.bcc;
        if (args.scheduledAtIso) payload.scheduled_at = args.scheduledAtIso;

        const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${args.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
            return {
                ok: false,
                status: r.status,
                error:
                    (data as { message?: string }).message ??
                    `Resend rejected the request (HTTP ${r.status})`,
            };
        }
        return { ok: true, status: 200, id: (data as { id?: string }).id };
    }

    if (args.provider === "sendgrid") {
        if (!args.apiKey) return { ok: false, status: 400, error: "SendGrid API key is missing" };
        const personalizations: Record<string, unknown> = {
            to: args.to.map((email) => ({ email })),
        };
        if (args.cc?.length) personalizations.cc = args.cc.map((email) => ({ email }));
        if (args.bcc?.length) personalizations.bcc = args.bcc.map((email) => ({ email }));
        if (args.scheduledAtIso) {
            personalizations.send_at = Math.floor(new Date(args.scheduledAtIso).getTime() / 1000);
        }

        const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${args.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                personalizations: [personalizations],
                from: { email: args.fromEmail, name: args.fromName || undefined },
                subject: args.subject,
                content: [{ type: "text/html", value: args.html }],
            }),
        });
        if (r.status === 202) return { ok: true, status: 202 };
        const data = await r.json().catch(() => ({}));
        return {
            ok: false,
            status: r.status,
            error:
                (data as { errors?: Array<{ message?: string }> }).errors?.[0]?.message ??
                `SendGrid rejected the request (HTTP ${r.status})`,
        };
    }

    if (args.provider === "ses") {
        return {
            ok: false,
            status: 501,
            error: "AWS SES sending is not yet implemented in this build.",
        };
    }

    return { ok: false, status: 400, error: "Unknown provider" };
}

export async function POST(req: Request) {
    let body: SendRequest;
    try {
        body = (await req.json()) as SendRequest;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.to?.length) {
        return NextResponse.json({ error: "At least one recipient is required" }, { status: 400 });
    }
    if (!body.subject?.trim()) {
        return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }

    // Validate scheduledAt
    let scheduledAtIso: string | undefined;
    if (body.scheduledAt) {
        const d = new Date(body.scheduledAt);
        if (Number.isNaN(d.getTime())) {
            return NextResponse.json({ error: "Invalid scheduledAt timestamp" }, { status: 400 });
        }
        if (d.getTime() <= Date.now()) {
            return NextResponse.json(
                { error: "Scheduled time must be in the future" },
                { status: 400 }
            );
        }
        scheduledAtIso = d.toISOString();
    }

    const userId = getUserIdFromRequest(req);
    const createdAt = new Date().toISOString();
    const isScheduled = !!scheduledAtIso;

    // Look up contacts + default signature once for personalization
    const contactsCol = await getCollection<ContactDoc>(COLLECTIONS.contacts);
    const allEmails = body.to.map((e) => e.toLowerCase());
    const contacts = await contactsCol.find({ userId, email: { $in: allEmails } }).toArray();
    const contactsByEmail = new Map<
        string,
        { name: string; role: string; company: string; email: string }
    >();
    contacts.forEach((c) =>
        contactsByEmail.set(c.email.toLowerCase(), {
            name: c.name,
            role: c.role,
            company: c.company,
            email: c.email,
        })
    );

    const sigCol = await getCollection<SignatureDoc>(COLLECTIONS.signatures);
    const defaultSig = await sigCol.findOne({ userId, isDefault: true });

    // ── Branch 1: SEND SEPARATELY (mail-merge) ──────────────────────────
    if (body.sendSeparately && body.to.length > 1) {
        let sentCount = 0;
        let failedCount = 0;
        const failures: Array<{ email: string; error: string }> = [];

        for (const recipient of body.to) {
            const ctx = buildPersonalizationContext({
                recipientEmails: [recipient],
                contactsByEmail,
                senderName: body.fromName,
                signatureHtml: defaultSig?.content ?? "",
                customVariables: body.customVariables,
            });
            const personalSubject = substitute(body.subject, ctx);
            const personalHtml = appendSignatureIfMissing(
                substitute(body.html, ctx),
                body.html,
                defaultSig?.content ?? ""
            );

            const result = await callProvider({
                provider: body.provider,
                apiKey: body.apiKey,
                fromName: body.fromName,
                fromEmail: body.fromEmail,
                to: [recipient],
                // cc/bcc intentionally omitted in send-separately mode
                subject: personalSubject,
                html: personalHtml,
                scheduledAtIso,
            });

            const log: EmailDoc = {
                id: randomUUID(),
                userId,
                provider: body.provider,
                providerMessageId: result.id,
                status: result.ok ? (isScheduled ? "scheduled" : "sent") : "failed",
                fromName: body.fromName,
                fromEmail: body.fromEmail,
                to: [recipient],
                subject: personalSubject,
                bodyPreview: htmlToPreview(personalHtml),
                body: personalHtml,
                scheduledAt: scheduledAtIso,
                sentAt: result.ok && !isScheduled ? new Date().toISOString() : undefined,
                error: result.ok ? undefined : result.error,
                createdAt,
            };
            await logEmail(log);

            if (result.ok) sentCount++;
            else {
                failedCount++;
                failures.push({ email: recipient, error: result.error ?? "Unknown error" });
            }
        }

        return NextResponse.json(
            {
                ok: failedCount === 0,
                sent: sentCount,
                failed: failedCount,
                total: body.to.length,
                failures: failures.length ? failures : undefined,
            },
            { status: failedCount === 0 ? 200 : failedCount === body.to.length ? 502 : 207 }
        );
    }

    // ── Branch 2: SINGLE SEND (legacy / "team" or single recipient) ─────
    const ctx = buildPersonalizationContext({
        recipientEmails: body.to,
        contactsByEmail,
        senderName: body.fromName,
        signatureHtml: defaultSig?.content ?? "",
        customVariables: body.customVariables,
    });
    const personalSubject = substitute(body.subject, ctx);
    const personalHtml = appendSignatureIfMissing(
        substitute(body.html, ctx),
        body.html,
        defaultSig?.content ?? ""
    );

    const result = await callProvider({
        provider: body.provider,
        apiKey: body.apiKey,
        fromName: body.fromName,
        fromEmail: body.fromEmail,
        to: body.to,
        cc: body.cc,
        bcc: body.bcc,
        subject: personalSubject,
        html: personalHtml,
        scheduledAtIso,
    });

    const log: EmailDoc = {
        id: randomUUID(),
        userId,
        provider: body.provider,
        providerMessageId: result.id,
        status: result.ok ? (isScheduled ? "scheduled" : "sent") : "failed",
        fromName: body.fromName,
        fromEmail: body.fromEmail,
        to: body.to,
        cc: body.cc,
        bcc: body.bcc,
        subject: personalSubject,
        bodyPreview: htmlToPreview(personalHtml),
        body: personalHtml,
        scheduledAt: scheduledAtIso,
        sentAt: result.ok && !isScheduled ? new Date().toISOString() : undefined,
        error: result.ok ? undefined : result.error,
        createdAt,
    };
    await logEmail(log);

    if (!result.ok) {
        return NextResponse.json({ error: result.error ?? "Send failed" }, { status: result.status });
    }
    return NextResponse.json({ ok: true, id: result.id });
}
