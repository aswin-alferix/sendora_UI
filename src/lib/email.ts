/**
 * Email address checks shared by the recipient chips and the compose form.
 * Practical rules (what mail providers actually accept), not the full RFC 5322 grammar.
 */

const LOCAL_CHARS = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/;
const DOMAIN_LABEL = /^[A-Za-z0-9-]+$/;

/** Why an address is invalid, in plain words, or null when it's fine. */
export function emailProblem(raw: string): string | null {
    const email = raw.trim();
    if (!email) return "Empty address";
    if (/\s/.test(email)) return "Contains a space";
    const at = email.lastIndexOf("@");
    if (at === -1) return "Missing @";
    if (email.indexOf("@") !== at) return "More than one @";
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (!local) return "Nothing before the @";
    if (!domain) return "Missing domain after the @";
    if (email.length > 254 || local.length > 64) return "Too long";
    if (!LOCAL_CHARS.test(local)) return "Has a character that isn't allowed";
    if (local.startsWith(".") || local.endsWith(".")) return "Can't start or end with a dot before the @";
    if (local.includes("..")) return "Two dots in a row";
    if (domain.includes("..")) return "Two dots in a row in the domain";
    const labels = domain.split(".");
    if (labels.length < 2) return "Domain needs a dot (e.g. example.com)";
    if (labels.some((l) => !l)) return "Domain has an empty part";
    if (labels.some((l) => !DOMAIN_LABEL.test(l))) return "Domain has a character that isn't allowed";
    if (labels.some((l) => l.startsWith("-") || l.endsWith("-"))) return "Domain part can't start or end with a hyphen";
    if (!/^[A-Za-z]{2,63}$/.test(labels[labels.length - 1])) return "Domain ending isn't valid (e.g. .com)";
    return null;
}

export function isValidEmail(raw: string): boolean {
    return emailProblem(raw) === null;
}

/**
 * Splits typed or pasted text into recipient entries, keeping every entry
 * (valid or not) so nothing disappears silently. Handles one-per-line lists,
 * comma/semicolon lists and Outlook's `Name <email>; Name <email>` format.
 */
export function parseRecipients(text: string): string[] {
    const out: string[] = [];
    for (const part of text.split(/[\r\n,;]+/)) {
        const p = part.trim();
        if (!p) continue;
        const bracketed = [...p.matchAll(/<([^<>]*)>/g)].map((m) => m[1].trim()).filter(Boolean);
        if (bracketed.length) {
            out.push(...bracketed);
            continue;
        }
        const cleaned = p.replace(/^["']+|["']+$/g, "").trim();
        const words = cleaned.split(/\s+/);
        // "a@x.com b@y.com" on one line → two entries; "john doe@example.com" stays one (invalid) entry
        if (words.length > 1 && words.every(isValidEmail)) out.push(...words);
        else if (cleaned) out.push(cleaned);
    }
    return out;
}
