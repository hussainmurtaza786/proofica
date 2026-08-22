import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

const protectedPaths = [
  "/dashboard",
  "/rentals",
  "/assets",
  "/customers",
  "/inspections",
  "/payments",
  "/expenses",
  "/budgets",
  "/maintenance",
  "/reports",
  "/notifications",
  "/settings",
  "/search",
];

const publicPaths = ["/login", "/register", "/share"];

/**
 * Builds the per-request Content-Security-Policy. Scripts are gated by a
 * per-request nonce with 'strict-dynamic'; 'unsafe-eval' is allowed in
 * development only (React refresh requires it).
 */
function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Per-request nonce. Setting the CSP on the REQUEST headers lets
  // Next.js stamp its own script tags with the same nonce.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return response;
  }

  if (pathname.startsWith("/api/auth")) {
    return response;
  }

  if (pathname.startsWith("/api/files")) {
    return response;
  }

  const needsAuth = protectedPaths.some((p) => pathname.startsWith(p));
  if (!needsAuth) {
    return response;
  }

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
