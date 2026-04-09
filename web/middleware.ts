import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "sadcpf_authenticated";
const LOGIN_PATH = "/login";

export function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const isAuth = Boolean(token);
  const path = request.nextUrl.pathname;

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
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Root redirect: send to dashboard if auth, else login
  if (path === "/") {
    return NextResponse.redirect(new URL(isAuth ? "/dashboard" : LOGIN_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
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
