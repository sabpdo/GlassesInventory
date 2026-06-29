import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes: no session required. Everything else redirects to /login.
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/p/", // phone scanner pairing page
];

const PUBLIC_EXACT = new Set(["/login", "/register"]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some(
    (p) => p.endsWith("/") && pathname.startsWith(p)
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Edge must decode the same cookie NextAuth sets in production
  // (__Secure-next-auth.session-token on HTTPS).
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });

  const signedIn = !!token?.email;

  // Already logged in — don't keep people on auth pages.
  if (signedIn && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!signedIn) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|api/register|api/pair|_next/static|_next/image|favicon.ico).*)",
  ],
};
