import { NextResponse, type NextRequest } from "next/server";

/** Optimistic check only — real verification happens in requireUserId(). */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("ew_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
