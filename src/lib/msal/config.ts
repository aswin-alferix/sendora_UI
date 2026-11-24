import { Configuration, PublicClientApplication, LogLevel } from "@azure/msal-browser";

/**
 * Microsoft Entra (Azure AD) configuration.
 *
 * Required setup:
 *   1. Register an SPA app at https://entra.microsoft.com → App registrations → New registration
 *   2. Set "Single-page application" platform with redirect URI:
 *        - http://localhost:3000/login   (local dev)
 *        - https://<your-domain>/login   (production)
 *   3. Copy the Application (client) ID and the Directory (tenant) ID
 *   4. Add these to .env.local:
 *        NEXT_PUBLIC_MSAL_CLIENT_ID=<your client id>
 *        NEXT_PUBLIC_MSAL_TENANT_ID=<your tenant id, or "common" for any account>
 *
 * Use "common" tenant to allow personal + any-org Microsoft accounts.
 * Use a specific tenant ID to lock to one organization.
 */

const clientId = process.env.NEXT_PUBLIC_MSAL_CLIENT_ID ?? "";
const tenantId = process.env.NEXT_PUBLIC_MSAL_TENANT_ID ?? "common";

export const isMsalConfigured = !!clientId;

export const msalConfig: Configuration = {
    auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: typeof window !== "undefined" ? `${window.location.origin}/login` : "/login",
        postLogoutRedirectUri:
            typeof window !== "undefined" ? `${window.location.origin}/login` : "/login",
    },
    cache: {
        cacheLocation: "sessionStorage",
    },
    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) return;
                if (level === LogLevel.Error) console.error("[MSAL]", message);
            },
            logLevel: LogLevel.Warning,
        },
    },
};

/** Scopes requested at sign-in. User.Read lets us call Graph /me for profile data. */
export const loginRequest = {
    scopes: ["User.Read", "openid", "profile", "email"],
};

/**
 * Singleton MSAL instance. Must call `await msalInstance.initialize()` before use.
 * That happens once in the MsalGate component.
 */
export const msalInstance = new PublicClientApplication(msalConfig);
