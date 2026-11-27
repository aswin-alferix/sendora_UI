"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import axios from "axios";
import { apiErrorMessage, authClient, refreshSession } from "@/lib/axios";

export { apiErrorMessage };

/**
 * Real sign-in against the NestJS API (sendors_API), called directly at
 * NEXT_PUBLIC_BACKEND_URL with axios (src/lib/axios.ts).
 *
 * The API keeps the session in httpOnly cookies (sendora_at = 15-minute access
 * token, sendora_rt = refresh token), so nothing secret is stored in the
 * browser. A JS-readable `sendora_session` hint lets proxy.ts know a session
 * exists. When an API call comes back 401, the axios client refreshes once and retries.
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
        const res = await authClient.get<{ user: ApiUser }>("/api/auth/me");
        return res.data.user;
    } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
            return (await refreshSession()) as unknown as ApiUser | null;
        }
        return null;
    }
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
        try {
            const res = await authClient.post<{ user: ApiUser }>(path, body);
            setUser(toAuthUser(res.data.user));
        } catch (err) {
            const status = axios.isAxiosError(err) ? err.response?.status : undefined;
            if (status === 429) throw new Error("Too many attempts. Wait a minute and try again.");
            if (status === undefined || status >= 500) throw new Error("Sendora's server isn't responding. Is the API running?");
            throw new Error(apiErrorMessage(axios.isAxiosError(err) ? err.response?.data : undefined, fallback));
        }
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
            await authClient.post("/api/auth/logout");
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
