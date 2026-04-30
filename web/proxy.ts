import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MUST_RESET_COOKIE = "sadcpf_must_reset";
const SETUP_COMPLETE_COOKIE = "sadcpf_setup_complete";
const LOGIN_PATH = "/login";
const RESET_PATH = "/reset-password";
const SETUP_PATH = "/setup";
/** When present on `/login`, skip redirect so the user can sign out client-side */
const LOGIN_SIGNOUT_PARAM = "signout";

const PUBLIC_PATH_PREFIXES = [
  "/approval",
  "/external-rfq",
];

const PUBLIC_PATHS = [
  LOGIN_PATH,
  "/supplier/register",
];

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/alerts",
  "/analytics",
  "/approvals",
  "/assets",
  "/assignments",
  "/correspondence",
  "/finance",
  "/governance",
  "/hr",
  "/imprest",
  "/leave",
  "/notifications",
  "/organogram",
  "/pif",
  "/procurement",
  "/profile",
  "/reports",
  "/risk",
  "/saam",
  "/settings",
  "/srhr",
  "/supplier",
  "/travel",
  "/workplan",
];

// Auth state is derived solely from the JS-controlled `sadcpf_authenticated`
// cookie. The Laravel session cookie is httpOnly and cannot be cleared by the
// client on 401 — using it as an auth signal causes /login → /setup redirect
// loops when the server-side session has expired but the cookie still exists.

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.includes(path)
    || PUBLIC_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function buildLoginRedirect(request: NextRequest, from: string): NextResponse {
  const loginUrl = new URL(LOGIN_PATH, request.url);
  if (from && from !== "/" && from !== LOGIN_PATH) {
    loginUrl.searchParams.set("from", from);
  }
  return NextResponse.redirect(loginUrl);
}

export function proxy(request: NextRequest) {
  const isAuth = Boolean(request.cookies.get("sadcpf_authenticated")?.value);
  const mustReset = Boolean(request.cookies.get(MUST_RESET_COOKIE)?.value);
  const setupComplete = Boolean(request.cookies.get(SETUP_COMPLETE_COOKIE)?.value);
  const path = request.nextUrl.pathname;
  const pathWithSearch = `${path}${request.nextUrl.search}`;

  if (path === "/") {
    return NextResponse.redirect(
      new URL(
        !isAuth
          ? LOGIN_PATH
          : mustReset
            ? RESET_PATH
            : !setupComplete
              ? SETUP_PATH
              : "/dashboard",
        request.url
      )
    );
  }

  if (isPublicPath(path)) {
    if (path === LOGIN_PATH && isAuth) {
      const wantsSignOut = request.nextUrl.searchParams.has(LOGIN_SIGNOUT_PARAM);
      if (!wantsSignOut) {
        return NextResponse.redirect(new URL(
          mustReset
            ? RESET_PATH
            : !setupComplete
              ? SETUP_PATH
              : "/dashboard",
          request.url
        ));
      }
    }
    return NextResponse.next();
  }

  if (!isAuth) {
    return buildLoginRedirect(request, pathWithSearch);
  }

  if (mustReset && path !== RESET_PATH) {
    return NextResponse.redirect(new URL(RESET_PATH, request.url));
  }

  if (path === RESET_PATH) {
    if (!mustReset && !setupComplete) {
      return NextResponse.redirect(new URL(SETUP_PATH, request.url));
    }
    if (!mustReset) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (path === SETUP_PATH) {
    if (mustReset) {
      return NextResponse.redirect(new URL(RESET_PATH, request.url));
    }
    if (setupComplete) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (isProtected) {
    if (!setupComplete) {
      return NextResponse.redirect(new URL(SETUP_PATH, request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/reset-password",
    "/setup",
    "/approval",
    "/external-rfq/:path*",
    "/dashboard/:path*",
    "/admin/:path*",
    "/alerts/:path*",
    "/analytics/:path*",
    "/approvals/:path*",
    "/assets/:path*",
    "/assignments/:path*",
    "/correspondence/:path*",
    "/finance/:path*",
    "/hr/:path*",
    "/imprest/:path*",
    "/leave/:path*",
    "/notifications/:path*",
    "/organogram/:path*",
    "/pif/:path*",
    "/governance/:path*",
    "/procurement/:path*",
    "/reports/:path*",
    "/profile/:path*",
    "/risk/:path*",
    "/saam/:path*",
    "/settings/:path*",
    "/srhr/:path*",
    "/supplier/:path*",
    "/travel/:path*",
    "/workplan/:path*",
  ],
};
