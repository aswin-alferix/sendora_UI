"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { AuthUser } from "@/lib/api/auth";

interface AuthContextValue {
    user: AuthUser | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    loginWithMicrosoft: () => Promise<void>;
    logout: () => Promise<void>;
}

const AUTH_TOKEN_KEY = "auth_token";
const AUTH_EMAIL_KEY = "auth_email";
const MOCK_TOKEN = "mock-session";

function persistToken(token: string) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    document.cookie = `${AUTH_TOKEN_KEY}=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
}

function clearToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_EMAIL_KEY);
    document.cookie = `${AUTH_TOKEN_KEY}=; path=/; max-age=0`;
}

function mockUser(email: string): AuthUser {
    const local = email.split("@")[0];
    const [first = "Demo", ...rest] = local.split(/[._-]/).filter(Boolean);
    return {
        id: "mock-user-1",
        email,
        firstName: first.charAt(0).toUpperCase() + first.slice(1),
        lastName: rest.length ? rest.join(" ").charAt(0).toUpperCase() + rest.join(" ").slice(1) : "User",
    };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Hydrate from any stored session
    useEffect(() => {
        const stored = localStorage.getItem(AUTH_TOKEN_KEY);
        const email = localStorage.getItem(AUTH_EMAIL_KEY);
        if (stored && email) {
            setToken(stored);
            // Re-set cookie in case it expired (e.g. browser restart)
            document.cookie = `${AUTH_TOKEN_KEY}=${encodeURIComponent(stored)}; path=/; SameSite=Lax`;
            setUser(mockUser(email));
        }
        setIsLoading(false);
    }, []);

    /**
     * Microsoft sign-in — currently BYPASSED (mock).
     *
     * Real MSAL is fully wired up in src/lib/msal/config.ts and src/components/providers.tsx.
     * To re-enable, swap this body for:
     *   const result = await msalInstance.loginPopup(loginRequest);
     *   ... persistToken(result.accessToken) ...
     */
    const loginWithMicrosoft = useCallback(async () => {
        // Brief delay so the UI feels real
        await new Promise((r) => setTimeout(r, 700));
        const email = "demo@sendora.local";
        persistToken(MOCK_TOKEN);
        localStorage.setItem(AUTH_EMAIL_KEY, email);
        setToken(MOCK_TOKEN);
        setUser(mockUser(email));
    }, []);

    const logout = useCallback(async () => {
        clearToken();
        setToken(null);
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isLoading,
                isAuthenticated: !!user,
                loginWithMicrosoft,
                logout,
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
