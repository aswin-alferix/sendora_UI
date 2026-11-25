/**
 * Template variable substitution for outgoing email.
 *
 * Supported syntax (case-insensitive):
 *   [Employee Name]   ← bracket form
 *   {{employee_name}} ← mustache form, snake_case
 *
 * Supported keys (auto-filled when sending):
 *   [Employee Name] / [Recipient Name] / [Name] — recipient name (or "team" for multi)
 *   [Job Title] / [Role]                       — recipient's role
 *   [Email]                                    — recipient's email
 *   [Company] / [Organisation] / [Organization] — recipient's company
 *   [Your Name]                                — sender name (from mail config)
 *   [Signature]                                — user's default signature (HTML)
 */

export function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SIGNATURE_PLACEHOLDER_RE = /\[\s*Signature\s*\]/i;

/**
 * Compact signature HTML produced by the rich-text editor so that each line
 * isn't a fully-padded <p>. We convert <p> blocks to <div style="margin:0">
 * with a tight line-height — what most email clients render as a clean
 * signature block.
 */
export function compactSignatureHtml(html: string): string {
    if (!html) return "";
    return html
        .replace(/<p(\s[^>]*)?>/gi, '<div style="margin:0;padding:0;line-height:1.45">')
        .replace(/<\/p>/gi, "</div>")
        // Strip leading/trailing whitespace + empty trailing wrappers
        .trim();
}

/**
 * Append the default signature to a body if the template didn't already
 * include a `[Signature]` placeholder (which would have been substituted in
 * place). Returns the HTML unchanged if there's nothing to append.
 *
 * Pass the ORIGINAL (pre-substitution) template so we can correctly detect
 * the placeholder — by the time substitute() has run, `[Signature]` would
 * already be replaced with the signature HTML.
 */
export function appendSignatureIfMissing(
    substitutedHtml: string,
    originalTemplate: string,
    signatureHtml: string
): string {
    const sig = signatureHtml?.trim();
    if (!sig) return substitutedHtml;
    if (SIGNATURE_PLACEHOLDER_RE.test(originalTemplate)) return substitutedHtml;
    // Single wrapper div controls the top spacing; inner content is tight.
    return `${substitutedHtml}<div style="margin-top:18px;line-height:1.45">${compactSignatureHtml(sig)}</div>`;
}

export function substitute(template: string, context: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(context)) {
        const safeValue = value ?? "";
        // [Bracket Form] — case-insensitive, allows internal whitespace
        const bracketRe = new RegExp(`\\[\\s*${escapeRegex(key)}\\s*\\]`, "gi");
        result = result.replace(bracketRe, safeValue);

        // {{mustache_form}} — snake_case key
        const mustacheKey = key.toLowerCase().replace(/\s+/g, "_");
        const mustacheRe = new RegExp(`\\{\\{\\s*${escapeRegex(mustacheKey)}\\s*\\}\\}`, "gi");
        result = result.replace(mustacheRe, safeValue);
    }
    return result;
}

interface ContactLite {
    name: string;
    role: string;
    company: string;
    email: string;
}

/** Capitalize "john.doe" → "John Doe" so unknown contacts still get a passable name. */
function nameFromEmail(email: string): string {
    const local = email.split("@")[0];
    return (
        local
            .split(/[._-]/)
            .filter(Boolean)
            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
            .join(" ") || "there"
    );
}

/**
 * Auto-filled keys. Anything else in a template is a "custom variable" the
 * user must fill in before sending (e.g. [Start Date], [Office Location]).
 */
export const AUTO_PLACEHOLDER_KEYS = new Set([
    "Employee Name",
    "Recipient Name",
    "Name",
    "Job Title",
    "Role",
    "Email",
    "Company",
    "Organisation",
    "Organization",
    "Your Name",
    "Signature",
]);

/** Extract unique [Bracket Tokens] from any string, trimmed. */
export function extractPlaceholders(text: string): string[] {
    if (!text) return [];
    const re = /\[([^\]\n<>]{1,80})\]/g;
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        const key = m[1].trim();
        if (key) seen.add(key);
    }
    return Array.from(seen);
}

export function buildPersonalizationContext(args: {
    recipientEmails: string[];
    contactsByEmail: Map<string, ContactLite>;
    senderName: string;
    signatureHtml: string;
    /** User-provided values for unresolved placeholders (e.g. { "Start Date": "Mon, Jun 3" }) */
    customVariables?: Record<string, string>;
}): Record<string, string> {
    let name: string;
    let role: string;
    let email: string;
    let company: string;

    if (args.recipientEmails.length === 1) {
        const recipient = args.recipientEmails[0];
        const match = args.contactsByEmail.get(recipient.toLowerCase());
        if (match) {
            name = match.name || nameFromEmail(recipient);
            role = match.role;
            email = match.email;
            company = match.company;
        } else {
            // Unknown contact — best-effort name from email local-part
            name = nameFromEmail(recipient);
            role = "";
            email = recipient;
            company = "";
        }
    } else {
        // Multiple recipients — generic "team"
        name = "team";
        role = "";
        email = args.recipientEmails.join(", ");
        company = "";
    }

    // Custom values come first so auto-resolved keys always win
    const custom = args.customVariables ?? {};
    return {
        ...custom,
        "Employee Name": name,
        "Recipient Name": name,
        "Name": name,
        "Job Title": role,
        "Role": role,
        "Email": email,
        "Company": company,
        "Organisation": company,
        "Organization": company,
        "Your Name": args.senderName,
        // Compact the signature so inline substitution doesn't bring paragraph margins along
        "Signature": compactSignatureHtml(args.signatureHtml),
    };
}
