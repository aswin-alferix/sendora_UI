/**
 * Auth scoping helper.
 *
 * For now we use a single hardcoded user id, since the auth flow is mocked.
 * When real Microsoft Entra (or any other) auth is wired up, replace this
 * with a function that reads the verified user id from the request — e.g.
 * a JWT in a cookie, an MSAL session, or a NextAuth session.
 */
export function getUserIdFromRequest(_req: Request): string {
    return "demo-user";
}
