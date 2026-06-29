import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email & Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      const user = await prisma.user.findUnique({
        where: { email: credentials.email.toLowerCase() },
      });
      if (!user || !user.password) return null;

      const ok = await bcrypt.compare(credentials.password, user.password);
      if (!ok) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name ?? undefined,
        image: user.image ?? undefined,
      };
    },
  }),
];

// Add Google provider only when credentials are configured. This makes it
// trivial to flip on later without code changes.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user, account }) {
      // Auto-provision a local user row for Google sign-ins so we have a
      // single source of truth for "who can use this app".
      if (account?.provider === "google" && user.email) {
        await prisma.user.upsert({
          where: { email: user.email.toLowerCase() },
          update: { name: user.name ?? undefined, image: user.image ?? undefined },
          create: {
            email: user.email.toLowerCase(),
            name: user.name ?? undefined,
            image: user.image ?? undefined,
          },
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      // Always resolve to *our* DB user id, not the provider's id, and
      // re-resolve on every request so a stale or wrong id (e.g. a Google
      // `sub` left over from an older sign-in) can't get stuck in the JWT
      // and cause foreign-key failures when we write soldById / createdById.
      const email = (user?.email ?? token.email) as string | undefined;
      if (email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: { id: true },
        });
        if (dbUser) {
          token.userId = dbUser.id;
        } else {
          // The user row was deleted — wipe the claim so requireUser()
          // sees them as unauthenticated.
          delete (token as { userId?: string }).userId;
        }
        // Re-check admin status every request so toggling ADMIN_EMAILS in
        // env takes effect on the next page load (no re-login required).
        (token as { isAdmin?: boolean }).isAdmin = isAdminEmail(email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        (session.user as { id?: string }).id = token.userId as string;
      }
      if (session.user) {
        (session.user as { isAdmin?: boolean }).isAdmin = Boolean(
          (token as { isAdmin?: boolean }).isAdmin
        );
      }
      return session;
    },
  },
};
