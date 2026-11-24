import { NextResponse } from "next/server";

interface TestRequest {
    provider: "resend" | "sendgrid" | "ses";
    apiKey?: string;
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    awsRegion?: string;
}

export async function POST(req: Request) {
    let body: TestRequest;
    try {
        body = (await req.json()) as TestRequest;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
        if (body.provider === "resend") {
            if (!body.apiKey) return NextResponse.json({ error: "API key is required" }, { status: 400 });
            // Auth check: hit /domains. 200 → key works. 401 → invalid.
            const r = await fetch("https://api.resend.com/domains", {
                headers: { Authorization: `Bearer ${body.apiKey}` },
            });
            if (r.status === 401) {
                return NextResponse.json({ error: "Invalid Resend API key" }, { status: 401 });
            }
            if (!r.ok) {
                return NextResponse.json(
                    { error: `Resend API returned ${r.status}` },
                    { status: r.status }
                );
            }
            return NextResponse.json({ ok: true });
        }

        if (body.provider === "sendgrid") {
            if (!body.apiKey) return NextResponse.json({ error: "API key is required" }, { status: 400 });
            const r = await fetch("https://api.sendgrid.com/v3/scopes", {
                headers: { Authorization: `Bearer ${body.apiKey}` },
            });
            if (r.status === 401) {
                return NextResponse.json({ error: "Invalid SendGrid API key" }, { status: 401 });
            }
            if (!r.ok) {
                return NextResponse.json(
                    { error: `SendGrid API returned ${r.status}` },
                    { status: r.status }
                );
            }
            return NextResponse.json({ ok: true });
        }

        if (body.provider === "ses") {
            // SES requires SigV4 signed requests — not yet implemented.
            // Validate that we at least have the basics to fail fast at send time.
            if (!body.awsAccessKeyId || !body.awsSecretAccessKey || !body.awsRegion) {
                return NextResponse.json(
                    { error: "Access key, secret, and region are all required for SES" },
                    { status: 400 }
                );
            }
            return NextResponse.json({
                ok: true,
                note: "SES credentials saved. End-to-end send is not yet wired up — Resend or SendGrid recommended for now.",
            });
        }

        return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Test request failed" },
            { status: 500 }
        );
    }
}
