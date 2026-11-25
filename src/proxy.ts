import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    // Set by the API alongside its httpOnly session cookies. Only a hint for
    // redirects; every /api call is still checked by the API itself.
    const token = request.cookies.get("sendora_session")?.value;

    if (!isPublic && !token) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.searchParams.set("from", pathname);
        return NextResponse.redirect(loginUrl);
    }

    if (isPublic && token) {
        const homeUrl = request.nextUrl.clone();
        homeUrl.pathname = "/";
        homeUrl.searchParams.delete("from");
        return NextResponse.redirect(homeUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
