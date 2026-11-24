/**
 * Lightweight template variable system.
 *
 * Supports two placeholder syntaxes:
 *   [Variable Name]
 *   {{Variable Name}}
 *
 * Resolution priority:
 *   1. Auto-resolvable values (recipient, sender, date)
 *   2. User-provided manual values
 *   3. Left as-is (the original placeholder string)
 */

export type VariableSource = "recipient" | "sender" | "date" | "manual";

export interface ResolvedVariable {
    name: string;
    value: string;
    source: VariableSource;
    /** True if a sensible value was inferred without user input. */
    auto: boolean;
}

export interface RecipientLike {
    name: string;
    email: string;
    company?: string;
    role?: string;
}

export interface SenderLike {
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    company?: string;
}

/** Extract all unique placeholder names found in `html`. Strips HTML first. */
export function extractVariables(html: string): string[] {
    const text = html.replace(/<[^>]*>/g, " ");
    const seen = new Set<string>();
    const out: string[] = [];

    const push = (raw: string) => {
        const name = raw.trim();
        if (!name || name.length > 60) return;
        if (!seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            out.push(name);
        }
    };

    text.replace(/\[([^\]\n]{1,60})\]/g, (_, name) => {
        push(name);
        return "";
    });
    text.replace(/\{\{\s*([^}\n]{1,60})\s*\}\}/g, (_, name) => {
        push(name);
        return "";
    });

    return out;
}

/** Capitalize a string token. */
function cap(s: string): string {
    return s.length ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
}

/** Best-effort name from an email address — "alex.mendez@x.com" → "Alex Mendez". */
function nameFromEmail(email: string): string {
    const local = email.split("@")[0];
    return local
        .split(/[._-]+/)
        .filter(Boolean)
        .map(cap)
        .join(" ");
}

/**
 * Build the recipient salutation:
 *   0 recipients  → ""              (manual)
 *   1 recipient   → contact's name (or fallback from email)
 *   2+ recipients → "team"
 */
export function recipientSalutation(
    recipients: RecipientLike[]
): { value: string; auto: boolean } {
    if (recipients.length === 0) return { value: "", auto: false };
    if (recipients.length === 1) {
        const r = recipients[0];
        return { value: r.name?.trim() || nameFromEmail(r.email) || r.email, auto: true };
    }
    return { value: "team", auto: true };
}

/**
 * Resolve every detected variable in `body` against the supplied data.
 * `manualValues` overrides any auto value for a given variable name.
 */
export function resolveVariables(
    body: string,
    recipients: RecipientLike[],
    sender: SenderLike,
    manualValues: Record<string, string> = {}
): ResolvedVariable[] {
    const detected = extractVariables(body);
    const senderName =
        (sender.name?.trim() ||
            [sender.firstName, sender.lastName].filter(Boolean).join(" ").trim()) ?? "";

    return detected.map((name): ResolvedVariable => {
        const key = name.toLowerCase();

        // Manual override always wins
        const manual = manualValues[name];
        if (manual !== undefined && manual !== "") {
            return { name, value: manual, source: "manual", auto: false };
        }

        // Recipient — name variants
        if (
            [
                "employee name",
                "recipient name",
                "name",
                "first name",
                "customer name",
                "client name",
            ].includes(key)
        ) {
            const sal = recipientSalutation(recipients);
            return { name, value: sal.value, source: "recipient", auto: sal.auto };
        }

        // Recipient — email
        if (["email", "recipient email"].includes(key) && recipients.length === 1) {
            return { name, value: recipients[0].email, source: "recipient", auto: true };
        }

        // Recipient — role / job title
        if (
            ["job title", "role", "position", "title"].includes(key) &&
            recipients.length === 1 &&
            recipients[0].role
        ) {
            return { name, value: recipients[0].role!, source: "recipient", auto: true };
        }

        // Recipient — company
        if (
            ["company", "company name", "organisation", "organization"].includes(key) &&
            recipients.length === 1 &&
            recipients[0].company
        ) {
            return { name, value: recipients[0].company!, source: "recipient", auto: true };
        }

        // Sender — name
        if (["your name", "sender name", "from name"].includes(key) && senderName) {
            return { name, value: senderName, source: "sender", auto: true };
        }

        // Sender — email
        if (["your email", "sender email"].includes(key) && sender.email) {
            return { name, value: sender.email, source: "sender", auto: true };
        }

        // Sender's company (fallback if recipient didn't have one)
        if (
            ["company", "company name", "organisation", "organization"].includes(key) &&
            sender.company
        ) {
            return { name, value: sender.company, source: "sender", auto: true };
        }

        // Date helpers
        if (["date", "today", "today's date"].includes(key)) {
            return {
                name,
                value: new Date().toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                }),
                source: "date",
                auto: true,
            };
        }

        // Manual but empty (user must fill)
        return { name, value: manual ?? "", source: "manual", auto: false };
    });
}

/** Replace every `[X]` and `{{X}}` occurrence using the resolved values. */
export function substituteVariables(html: string, resolved: ResolvedVariable[]): string {
    let out = html;
    for (const v of resolved) {
        if (!v.value) continue;
        const escaped = v.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        out = out.replace(new RegExp(`\\[${escaped}\\]`, "gi"), v.value);
        out = out.replace(new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, "gi"), v.value);
    }
    return out;
}

/**
 * Append a signature to an HTML body. Wraps the signature in a paragraph
 * separator so it doesn't merge with the last line.
 */
export function appendSignature(html: string, signatureHtml: string): string {
    if (!signatureHtml) return html;
    return `${html}<div style="margin-top:24px">${signatureHtml}</div>`;
}
