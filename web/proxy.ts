import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildContentSecurityPolicy, createCspNonce } from "@/lib/contentSecurityPolicy";

const isProduction = process.env.NODE_ENV === "production";

const MUST_RESET_COOKIE = "sadcpf_must_reset";
const SETUP_COMPLETE_COOKIE = "sadcpf_setup_complete";
const PORTAL_COOKIE = "sadcpf_portal";
const LOGIN_PATH = "/login";
const RESET_PATH = "/reset-password";
const SETUP_PATH = "/setup";
/** When present on `/login`, skip redirect so the user can sign out client-side */
const LOGIN_SIGNOUT_PARAM = "signout";

const PUBLIC_PATH_PREFIXES = [
  "/approval",
  "/external-rfq",
  "/a",
];

const PUBLIC_PATHS = [
  LOGIN_PATH,
  "/forgot-password",
  "/request-password",
  "/activate-account",
  "/supplier/login",
  "/supplier/register",
  "/supplier/verify-email",
  "/tender-notices",
  "/parliament-connect",
];

/** Unauthenticated token-reset links must reach the form (email deep links). */
const ANON_OK_PATHS = [
  "/forgot-password",
  "/request-password",
  "/activate-account",
  RESET_PATH,
];

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/alerts",
  "/analytics",
  "/approvals",
  "/assets",
  "/fleet",
  "/assignments",
  "/contracts",
  "/correspondence",
  "/finance",
  "/governance",
  "/hr",
  "/imprest",
  "/leave",
  "/mande",
  "/notifications",
  "/organogram",
  "/pif",
  "/procurement",
  "/profile",
  "/reports",
  "/risk",
  "/saam",
  "/salary-advances",
  "/settings",
  "/srhr",
  "/stock",
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
  const supplierFlow = from === "/supplier" || from.startsWith("/supplier/");
  const loginUrl = new URL(supplierFlow ? "/supplier/login" : LOGIN_PATH, request.url);
  if (from && from !== "/" && from !== LOGIN_PATH && from !== "/supplier/login") {
    loginUrl.searchParams.set("from", from);
  }
  return NextResponse.redirect(loginUrl);
}

function isSupplierAppPath(path: string): boolean {
  if (path === "/supplier/login" || path === "/supplier/register" || path === "/supplier/verify-email") return false;
  return path === "/supplier" || path.startsWith("/supplier/");
}

function authRedirects(request: NextRequest, next: () => NextResponse): NextResponse {
  const isAuth = Boolean(request.cookies.get("sadcpf_authenticated")?.value);
  const mustReset = Boolean(request.cookies.get(MUST_RESET_COOKIE)?.value);
  const setupComplete = Boolean(request.cookies.get(SETUP_COMPLETE_COOKIE)?.value);
  const supplierPortal = request.cookies.get(PORTAL_COOKIE)?.value === "supplier";
  const path = request.nextUrl.pathname;
  const pathWithSearch = `${path}${request.nextUrl.search}`;

  if (path === "/") {
    return NextResponse.redirect(
      new URL(
        !isAuth
          ? LOGIN_PATH
          : mustReset
            ? RESET_PATH
            : supplierPortal || isSupplierAppPath(path)
              ? "/supplier"
              : !setupComplete
                ? SETUP_PATH
                : "/dashboard",
        request.url
      )
    );
  }

  if (isPublicPath(path)) {
    if ((path === LOGIN_PATH || path === "/supplier/login") && isAuth) {
      const wantsSignOut = request.nextUrl.searchParams.has(LOGIN_SIGNOUT_PARAM);
      if (!wantsSignOut) {
        return NextResponse.redirect(new URL(
          mustReset
            ? RESET_PATH
            : path === "/supplier/login" || supplierPortal
              ? "/supplier"
              : !setupComplete
                ? SETUP_PATH
                : "/dashboard",
          request.url
        ));
      }
    }
    return next();
  }

  if (!isAuth) {
    if (ANON_OK_PATHS.includes(path)) {
      return next();
    }
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
    return next();
  }

  if (path === SETUP_PATH) {
    if (mustReset) {
      return NextResponse.redirect(new URL(RESET_PATH, request.url));
    }
    if (supplierPortal) {
      return NextResponse.redirect(new URL("/supplier", request.url));
    }
    if (setupComplete) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return next();
  }

  // Allow MFA setup during onboarding so Setup → Security can reach the real page.
  const allowDuringSetup =
    path === "/profile/security" || path.startsWith("/profile/security/");

  const isProtected = PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (isProtected) {
    if (!setupComplete && !allowDuringSetup && !supplierPortal && !isSupplierAppPath(path)) {
      return NextResponse.redirect(new URL(SETUP_PATH, request.url));
    }
    return next();
  }

  return next();
}

/** Paths the auth redirects above apply to (the previous proxy matcher). */
const AUTH_EXACT_PATHS = [
  "/",
  "/login",
  "/forgot-password",
  "/request-password",
  "/activate-account",
  "/reset-password",
  "/setup",
  "/approval",
];

const AUTH_PREFIXES = [
  "/external-rfq",
  ...PROTECTED_PREFIXES,
];

function needsAuthRedirects(path: string): boolean {
  return AUTH_EXACT_PATHS.includes(path)
    || AUTH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest) {
  if (!isProduction) {
    return needsAuthRedirects(request.nextUrl.pathname)
      ? authRedirects(request, () => NextResponse.next())
      : NextResponse.next();
  }

  const nonce = createCspNonce();
  const csp = buildContentSecurityPolicy(nonce, process.env.NEXT_PUBLIC_API_URL);
  // Next reads the nonce from the request CSP header and stamps it on its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  const response = needsAuthRedirects(request.nextUrl.pathname) ? authRedirects(request, next) : next();
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Every page (for the CSP nonce); API proxy routes and static assets excluded.
    "/((?!api/|sanctum/|_next/static|_next/image|vendors/|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|js|css|map|txt|xml|json|pdf)$).*)",
  ],
};
