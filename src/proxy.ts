import { NextResponse, type NextRequest } from "next/server";
import { hasSessionCookie, isPublicPath } from "@/auth/routes";
import { contentSecurityPolicy, newNonce } from "@/security/headers";

/**
 * Sets the Content-Security-Policy with a fresh nonce, and sends signed-out
 * visitors to sign-in, remembering where they were going. The sign-in check
 * is a quick cookie check only; the (app) layout verifies the session.
 */
export function proxy(request: NextRequest) {
  const nonce = newNonce();
  const csp = contentSecurityPolicy(nonce);
  const { pathname, search } = request.nextUrl;

  let response: NextResponse;
  if (isPublicPath(pathname) || hasSessionCookie(request.cookies)) {
    // Next reads the nonce from the request's CSP header while rendering and
    // adds it to its scripts.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("callbackUrl", pathname + search);
    response = NextResponse.redirect(signIn);
  }
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Everything except Next's assets and files with an extension (icons, images).
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-z0-9]+$).*)"],
};
