import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  ensureAdminUser,
  isAdminLogin,
  isUserAdmin,
  syncEnvAdminFlag,
} from "@/lib/admin";
import { findUserByLogin, getUserLogin, normalizeLogin } from "@/lib/users";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email or username & Password",
    credentials: {
      login: { label: "Email or username", type: "text" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.login || !credentials?.password) return null;

      const login = normalizeLogin(credentials.login);

      if (isAdminLogin(login)) {
        await ensureAdminUser();
      }

      const user = await findUserByLogin(login);
      if (!user || !user.password || !user.active) return null;

      const ok = await bcrypt.compare(credentials.password, user.password);
      if (!ok) return null;

      if (isAdminLogin(login)) {
        await syncEnvAdminFlag(user.id, login);
      }

      return {
        id: user.id,
        email: getUserLogin(user),
        name: user.name ?? undefined,
        image: user.image ?? undefined,
      };
    },
  }),
];

// Google only works for accounts the admin has already created.
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
  ...(process.env.NODE_ENV === "production" ? { trustHost: true } : {}),
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const lower = user.email.toLowerCase();

        if (isAdminLogin(lower)) {
          await ensureAdminUser();
        }

        const existing = await prisma.user.findUnique({
          where: { email: lower },
        });
        // No self-registration: Google sign-in only for whitelisted users.
        if (!existing || !existing.active) return false;

        await prisma.user.update({
          where: { email: lower },
          data: {
            name: user.name ?? undefined,
            image: user.image ?? undefined,
          },
        });
        if (existing.id) {
          await syncEnvAdminFlag(existing.id, lower);
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      const login = (user?.email ?? token.email) as string | undefined;
      if (login) {
        const dbUser = await findUserByLogin(login);
        if (dbUser?.active) {
          token.userId = dbUser.id;
          (token as { isAdmin?: boolean }).isAdmin = isUserAdmin(dbUser);
        } else {
          delete (token as { userId?: string }).userId;
          (token as { isAdmin?: boolean }).isAdmin = false;
        }
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
