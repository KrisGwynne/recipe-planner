import { NextResponse, type NextRequest } from "next/server";
import { hasSessionCookie, isPublicPath } from "@/auth/routes";

/**
 * Sends signed-out visitors to sign-in, remembering where they were going.
 * A quick cookie check only; the (app) layout verifies the session.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname) || hasSessionCookie(request.cookies)) return NextResponse.next();

  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("callbackUrl", pathname + search);
  return NextResponse.redirect(signIn);
}

export const config = {
  // Everything except Next's assets and files with an extension (icons, images).
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-z0-9]+$).*)"],
};
