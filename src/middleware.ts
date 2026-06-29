import { withAuth } from "next-auth/middleware";

// `withAuth` lets us point unauthenticated requests at our custom /login page
// instead of NextAuth's stock /api/auth/signin page.
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Protect everything except: auth endpoints, login/register pages, the
  // public phone-scanner page (`/p/<code>`) and the pairing API it uses,
  // Next internals, and static assets.
  matcher: [
    "/((?!api/auth|api/register|api/pair|login|register|p/|_next/static|_next/image|favicon.ico).*)",
  ],
};
