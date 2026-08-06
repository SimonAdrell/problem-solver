import { NextRequest, NextResponse } from "next/server"

// Gates every route except the public auth pages. The session cookie is an
// opaque Flask-Security cookie we can't verify here, so we ask the backend
// (via the same /api rewrite the browser uses) whether it's still valid.
export async function proxy(request: NextRequest) {
    const res = await fetch(new URL("/api/me", request.url), {
        headers: { cookie: request.headers.get("cookie") ?? "" },
    })
    if (res.ok) return NextResponse.next()
    return NextResponse.redirect(new URL("/login", request.url))
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|register|reset-password).*)"],
}
