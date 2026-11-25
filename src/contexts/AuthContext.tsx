"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

/**
 * Real sign-in against the NestJS API (sendors_API), proxied through /api.
 *
 * The API keeps the session in httpOnly cookies (sendora_at = 15-minute access
 * token, sendora_rt = refresh token), so nothing secret is stored in the
 * browser. A JS-readable `sendora_session` hint lets proxy.ts know a session
 * exists. When any /api call comes back 401, we refresh once and retry.
 */

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    /** Derived from `name` for the existing Settings/top-bar UI. */
    firstName: string;
    lastName: string;
    company?: string;
    hasPassword: boolean;
    mailbox: { connected: boolean; email: string | null; status: string | null };
}

interface ApiUser {
    id: string;
    email: string;
    name: string;
    hasPassword: boolean;
    mailbox: AuthUser["mailbox"];
}

interface AuthContextValue {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    loginWithPassword: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    /** Full-page redirect to Microsoft (MSAL); afterwards the login page calls completeMicrosoftSignIn. */
    loginWithMicrosoft: (returnTo?: string) => Promise<void>;
    /** Finishes a Microsoft redirect. Resolves to where to go next, or null if there was no response. */
    completeMicrosoftSignIn: () => Promise<string | null>;
    logout: () => Promise<void>;
    reloadUser: () => Promise<void>;
}

function toAuthUser(u: ApiUser): AuthUser {
    const [first = "", ...rest] = (u.name || "").trim().split(/\s+/);
    return { ...u, firstName: first, lastName: rest.join(" ") };
}

/** Readable message from the API's { statusCode, error, message } shape. */
export function apiErrorMessage(data: unknown, fallback: string): string {
    const d = (data ?? {}) as { message?: unknown; error?: unknown };
    if (Array.isArray(d.message) && d.message.length) return d.message.join(". ");
    if (typeof d.message === "string" && d.message) return d.message;
    if (typeof d.error === "string" && d.error) return d.error;
    return fallback;
}

// ─── Session refresh shared by the context and the fetch wrapper ──────────

let refreshInFlight: Promise<ApiUser | null> | null = null;
let nativeFetch: typeof fetch | null = null;

function rawFetch(input: RequestInfo | URL, init?: RequestInit) {
    return (nativeFetch ?? fetch)(input, init);
}

/** One refresh at a time, however many requests hit 401 together. */
function refreshSession(): Promise<ApiUser | null> {
    if (!refreshInFlight) {
        refreshInFlight = rawFetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" })
            .then(async (res) => (res.ok ? ((await res.json()) as { user: ApiUser }).user : null))
            .catch(() => null)
            .finally(() => {
                refreshInFlight = null;
            });
    }
    return refreshInFlight;
}

function isApiCall(input: RequestInfo | URL): boolean {
    const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    try {
        const u = new URL(url, window.location.origin);
        return (
            u.origin === window.location.origin &&
            u.pathname.startsWith("/api/") &&
            !u.pathname.startsWith("/api/auth/")
        );
    } catch {
        return false;
    }
}

/** True when the URL holds a Microsoft sign-in response (#code=… or #error=…). */
export function hasMsalResponse(): boolean {
    if (typeof window === "undefined") return false;
    return /[#&](code|error)=/.test(window.location.hash);
}

/** MSAL is loaded only when Microsoft sign-in is used, not on every page. */
async function loadMsal() {
    const msal = await import("@/lib/msal/config");
    if (!msal.isMsalConfigured) {
        throw new Error(
            "Microsoft sign-in isn't set up in this app yet (NEXT_PUBLIC_MSAL_CLIENT_ID). Use your email and password for now."
        );
    }
    await msal.msalInstance.initialize();
    return msal;
}

/** Current user from the API, refreshing once if the access token has expired. */
async function fetchSessionUser(): Promise<ApiUser | null> {
    try {
        const res = await rawFetch("/api/auth/me", { credentials: "same-origin" });
        if (res.ok) return ((await res.json()) as { user: ApiUser }).user;
        if (res.status === 401) return await refreshSession();
        return null;
    } catch {
        return null;
    }
}

function goToLogin() {
    const { pathname, search } = window.location;
    if (pathname.startsWith("/login")) return;
    window.location.assign(`/login?from=${encodeURIComponent(pathname + search)}`);
}

/**
 * Wrap window.fetch once: a 401 from our API triggers one refresh + retry,
 * so the pages' plain fetch("/api/...") calls keep working past the
 * 15-minute access-token lifetime. If refresh fails, go to the login page.
 */
function installFetchWrapper() {
    if (typeof window === "undefined" || nativeFetch) return;
    nativeFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const res = await nativeFetch!(input, init);
        if (res.status !== 401 || !isApiCall(input)) return res;
        // A Request object's body can only be read once; only retry plain url+init calls.
        if (typeof input !== "string" && !(input instanceof URL)) return res;
        const user = await refreshSession();
        if (!user) {
            goToLogin();
            return res;
        }
        return nativeFetch!(input, init);
    };
}

// ─── Provider ─────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const reloadUser = useCallback(async () => {
        const u = await fetchSessionUser();
        setUser(u ? toAuthUser(u) : null);
    }, []);

    // Check the session on load (cookies are httpOnly, so ask the API).
    useEffect(() => {
        installFetchWrapper();
        let cancelled = false;
        fetchSessionUser().then((u) => {
            if (cancelled) return;
            setUser(u ? toAuthUser(u) : null);
            setIsLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const authPost = useCallback(async (path: string, body: unknown, fallback: string) => {
        const res = await rawFetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (res.status === 429) throw new Error("Too many attempts. Wait a minute and try again.");
            if (res.status >= 500) throw new Error("Sendora's server isn't responding. Is the API running?");
            throw new Error(apiErrorMessage(data, fallback));
        }
        setUser(toAuthUser((data as { user: ApiUser }).user));
    }, []);

    const loginWithPassword = useCallback(
        (email: string, password: string) =>
            authPost("/api/auth/login", { email, password }, "Sign-in failed. Please try again."),
        [authPost]
    );

    const register = useCallback(
        (name: string, email: string, password: string) =>
            authPost("/api/auth/register", { name, email, password }, "Couldn't create the account."),
        [authPost]
    );

    // Microsoft sign-in, same model as Nexus: MSAL signs the user in with
    // Microsoft in the browser, then the API verifies the ID token
    // (/api/auth/msal-login) and starts a normal Sendora session.
    const loginWithMicrosoft = useCallback(async (returnTo = "/") => {
        const msal = await loadMsal();
        await msal.msalInstance.loginRedirect({
            ...msal.loginRequest,
            state: returnTo,
            prompt: "select_account",
        });
    }, []);

    const completeMicrosoftSignIn = useCallback(async () => {
        const msal = await loadMsal();
        // Stay on /login; we navigate ourselves once the API has signed us in.
        const result = await msal.msalInstance.handleRedirectPromise({ navigateToLoginRequestUrl: false });
        if (!result?.idToken) return null;
        await authPost("/api/auth/msal-login", { idToken: result.idToken }, "Microsoft sign-in failed.");
        return result.state || "/";
    }, [authPost]);

    const logout = useCallback(async () => {
        try {
            await rawFetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
        } catch {
            /* cookies are cleared server-side; nothing else to do */
        }
        // Forget the cached Microsoft account in this browser (doesn't sign out of Microsoft).
        try {
            const msal = await import("@/lib/msal/config");
            if (msal.isMsalConfigured) {
                await msal.msalInstance.initialize();
                await msal.msalInstance.clearCache();
            }
        } catch {
            /* nothing cached */
        }
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                loginWithPassword,
                register,
                loginWithMicrosoft,
                completeMicrosoftSignIn,
                logout,
                reloadUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
}
