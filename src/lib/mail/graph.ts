/**
 * Microsoft Graph mail sending (app-only, client credentials).
 *
 * Sends as a single shared mailbox (MAIL_SENDER_ADDRESS) via
 * POST /users/{sender}/sendMail. Credentials stay on the server — they are
 * read from env, never from the browser.
 *
 * Env (.env.local):
 *   AZURE_AD_TENANT_ID     — Directory (tenant) ID
 *   MAIL_APP_CLIENT_ID     — App used for mail (falls back to AZURE_AD_CLIENT_ID)
 *   AZURE_AD_CLIENT_ID     — Fallback app ID
 *   AZURE_AD_CLIENT_SECRET — Client secret of that app
 *   MAIL_SENDER_ADDRESS    — Mailbox to send from (e.g. noreply@yourcompany.com)
 *
 * The app needs the Microsoft Graph *Application* permission Mail.Send with
 * admin consent.
 */

const TOKEN_TIMEOUT_MS = 10_000;
const SEND_TIMEOUT_MS = 15_000;
const SEND_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export interface GraphConfig {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    senderAddress: string;
}

/** Returns the Graph config from env, or null if anything required is missing. */
export function getGraphConfig(): GraphConfig | null {
    const tenantId = process.env.AZURE_AD_TENANT_ID;
    // Separate mail app from the login app so they don't interfere.
    const clientId = process.env.MAIL_APP_CLIENT_ID || process.env.AZURE_AD_CLIENT_ID;
    const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
    const senderAddress = process.env.MAIL_SENDER_ADDRESS;
    if (!tenantId || !clientId || !clientSecret || !senderAddress) return null;
    return { tenantId, clientId, clientSecret, senderAddress };
}

export const GRAPH_NOT_CONFIGURED =
    "Microsoft 365 is not configured on the server. Set AZURE_AD_TENANT_ID, MAIL_APP_CLIENT_ID (or AZURE_AD_CLIENT_ID), AZURE_AD_CLIENT_SECRET and MAIL_SENDER_ADDRESS in .env.local, then restart the dev server.";

// Reuse the token until shortly before it expires (send-separately sends many in a row).
let cachedToken: { value: string; expiresAt: number; clientId: string } | null = null;

export async function getGraphToken(cfg: GraphConfig): Promise<string> {
    if (cachedToken && cachedToken.clientId === cfg.clientId && cachedToken.expiresAt > Date.now()) {
        return cachedToken.value;
    }
    const res = await fetch(
        `https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`,
        {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "client_credentials",
                client_id: cfg.clientId,
                client_secret: cfg.clientSecret,
                scope: "https://graph.microsoft.com/.default",
            }),
            signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
        }
    );
    const data = (await res.json().catch(() => ({}))) as {
        access_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
    };
    if (!res.ok || !data.access_token) {
        const detail = data.error_description?.split("\r\n")[0] ?? data.error ?? `HTTP ${res.status}`;
        throw new Error(`Microsoft token request failed: ${detail}`);
    }
    cachedToken = {
        value: data.access_token,
        clientId: cfg.clientId,
        // Refresh a minute early
        expiresAt: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000,
    };
    return data.access_token;
}

function toRecipients(list: string[]) {
    return list.map((address) => ({ emailAddress: { address } }));
}

/** Trim, drop blanks and de-duplicate (case-insensitive), keeping first spelling. */
function cleanList(list: string[] | undefined, exclude: Set<string> = new Set()): string[] {
    const seen = new Set(exclude);
    const out: string[] = [];
    for (const raw of list ?? []) {
        const e = raw?.trim();
        if (!e || seen.has(e.toLowerCase())) continue;
        seen.add(e.toLowerCase());
        out.push(e);
    }
    return out;
}

export interface GraphSendResult {
    ok: boolean;
    status: number;
    error?: string;
}

/**
 * Send one email through Graph. Retries throttling / transient errors
 * (429, 5xx, network) with exponential backoff, like the Nexus mailer.
 */
export async function sendViaGraph(args: {
    fromName: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    html: string;
}): Promise<GraphSendResult> {
    const cfg = getGraphConfig();
    if (!cfg) return { ok: false, status: 500, error: GRAPH_NOT_CONFIGURED };

    const to = cleanList(args.to);
    if (!to.length) return { ok: false, status: 400, error: "At least one recipient is required" };
    const toSet = new Set(to.map((e) => e.toLowerCase()));
    const cc = cleanList(args.cc, toSet);
    const bcc = cleanList(args.bcc, new Set([...toSet, ...cc.map((e) => e.toLowerCase())]));

    const message: Record<string, unknown> = {
        subject: args.subject,
        body: { contentType: "HTML", content: args.html },
        from: {
            emailAddress: {
                name: args.fromName || undefined,
                address: cfg.senderAddress,
            },
        },
        toRecipients: toRecipients(to),
    };
    if (cc.length) message.ccRecipients = toRecipients(cc);
    if (bcc.length) message.bccRecipients = toRecipients(bcc);

    const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.senderAddress)}/sendMail`;

    let token: string;
    try {
        token = await getGraphToken(cfg);
    } catch (err) {
        return { ok: false, status: 502, error: err instanceof Error ? err.message : "Token request failed" };
    }

    for (let attempt = 1; attempt <= SEND_ATTEMPTS; attempt++) {
        const isLast = attempt === SEND_ATTEMPTS;
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ message, saveToSentItems: true }),
                signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
            });
            // Graph returns 202 Accepted with an empty body on success
            if (res.ok) return { ok: true, status: 202 };

            const data = (await res.json().catch(() => ({}))) as {
                error?: { code?: string; message?: string };
            };
            const error = data.error?.message
                ? `${data.error.code ? `${data.error.code}: ` : ""}${data.error.message}`
                : `Microsoft Graph rejected the request (HTTP ${res.status})`;

            if (isLast || !RETRYABLE_STATUS.has(res.status)) {
                return { ok: false, status: res.status, error };
            }
            console.warn(`[graph] send attempt ${attempt}/${SEND_ATTEMPTS} failed (${res.status}) — retrying`);
        } catch (err) {
            // Network error / timeout
            if (isLast) {
                return {
                    ok: false,
                    status: 502,
                    error: err instanceof Error ? err.message : "Network error calling Microsoft Graph",
                };
            }
            console.warn(`[graph] send attempt ${attempt}/${SEND_ATTEMPTS} failed (network) — retrying`);
        }
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    }
    return { ok: false, status: 502, error: "Send failed" };
}
