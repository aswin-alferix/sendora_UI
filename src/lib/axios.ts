import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";

/** Pull a readable message out of an API error body ({ message } from NestJS). */
export function apiErrorMessage(data: unknown, fallback: string): string {
    const d = (data ?? {}) as { message?: unknown; error?: unknown };
    if (Array.isArray(d.message) && d.message.length) return d.message.join(". ");
    if (typeof d.message === "string" && d.message) return d.message;
    if (typeof d.error === "string" && d.error) return d.error;
    return fallback;
}

const baseURL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").replace(/\/$/, "");

/**
 * Auth calls (login, refresh, me, logout). Same backend and cookies, but no
 * refresh-on-401 interceptor, so a failed refresh can't loop.
 */
export const authClient = axios.create({ baseURL, withCredentials: true });

/** Every other API call. Calls NEXT_PUBLIC_BACKEND_URL directly with the session cookies. */
export const backend = axios.create({ baseURL, withCredentials: true });

/**
 * For calls that read the status themselves (e.g. 207 partial success, 502 with
 * per-recipient failures): any status resolves, except 401, which still goes
 * through the refresh-and-retry interceptor below.
 */
export const anyStatus: AxiosRequestConfig = { validateStatus: (status) => status !== 401 };

// ─── Session refresh ──────────────────────────────────────────────────────

/** The signed-in user as the API returns it ({ user } from /api/auth/*). */
export type SessionUser = { id: string; email: string; name: string; [key: string]: unknown };

let refreshInFlight: Promise<SessionUser | null> | null = null;

/** One refresh at a time, however many requests hit 401 together. */
export function refreshSession(): Promise<SessionUser | null> {
    if (!refreshInFlight) {
        refreshInFlight = authClient
            .post<{ user: SessionUser }>("/api/auth/refresh")
            .then((res) => res.data.user)
            .catch(() => null)
            .finally(() => {
                refreshInFlight = null;
            });
    }
    return refreshInFlight;
}

export function goToLogin() {
    const { pathname, search } = window.location;
    if (pathname.startsWith("/login")) return;
    window.location.assign(`/login?from=${encodeURIComponent(pathname + search)}`);
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// A 401 refreshes the session once and retries; if the refresh fails, go to login.
// Other errors get the server's own message, so `err.message` is readable in toasts.
backend.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    if (error.response?.status === 401 && config && !config._retried) {
        config._retried = true;
        const user = await refreshSession();
        if (user) return backend(config);
        goToLogin();
    }
    if (error.response) {
        error.message = apiErrorMessage(error.response.data, `Request failed (HTTP ${error.response.status})`);
    } else if (!error.response && error.code !== "ERR_CANCELED") {
        error.message = "Can't reach the Sendora API. Is it running?";
    }
    throw error;
});
