import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "sadcpf_authenticated";
const MUST_RESET_COOKIE = "sadcpf_must_reset";
const LOGIN_PATH = "/login";
const RESET_PATH = "/reset-password";

export function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const mustReset = Boolean(request.cookies.get(MUST_RESET_COOKIE)?.value);
  const isAuth = Boolean(token);
  const path = request.nextUrl.pathname;

  // If authenticated but must reset password, force to reset-password page
  if (isAuth && mustReset && path !== RESET_PATH) {
    return NextResponse.redirect(new URL(RESET_PATH, request.url));
  }

  // Prevent access to reset-password if not authenticated
  if (path === RESET_PATH) {
    if (!isAuth) {
      return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    }
    return NextResponse.next();
  }

  // Protect app routes: require auth (all routes under app shell)
  const protectedPrefixes = [
    "/dashboard", "/admin", "/travel", "/leave", "/imprest", "/procurement",
    "/finance", "/hr", "/pif", "/workplan", "/approvals", "/alerts", "/governance",
    "/reports", "/profile", "/assets", "/organogram", "/analytics", "/assignments",
    "/srhr", "/notifications", "/saam", "/settings",
  ];
  const isProtected = protectedPrefixes.some((prefix) => path.startsWith(prefix));
  if (isProtected) {
    if (!isAuth) {
      const loginUrl = new URL(LOGIN_PATH, request.url);
      loginUrl.searchParams.set("from", path);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Redirect logged-in users away from login
  if (path === LOGIN_PATH || path === "/login") {
    if (isAuth) {
      return NextResponse.redirect(new URL(mustReset ? RESET_PATH : "/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Root redirect: send to dashboard if auth, else login
  if (path === "/") {
    return NextResponse.redirect(new URL(isAuth ? (mustReset ? RESET_PATH : "/dashboard") : LOGIN_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/reset-password",
    "/dashboard/:path*",
    "/admin/:path*",
    "/travel/:path*",
    "/leave/:path*",
    "/imprest/:path*",
    "/procurement/:path*",
    "/finance/:path*",
    "/hr/:path*",
    "/pif/:path*",
    "/workplan/:path*",
    "/approvals/:path*",
    "/alerts/:path*",
    "/governance/:path*",
    "/reports/:path*",
    "/profile/:path*",
    "/assets/:path*",
    "/organogram/:path*",
    "/analytics/:path*",
    "/assignments/:path*",
    "/srhr/:path*",
    "/notifications/:path*",
    "/saam/:path*",
    "/settings/:path*",
  ],
};
