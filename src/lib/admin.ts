import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Primary admin bootstraps from ADMIN_EMAIL + ADMIN_PASSWORD in env.
// Additional admins can be promoted from the Team page (stored as isAdmin
// on the user row). Env ADMIN_EMAILS still grants admin on sign-in.

export function getAdminEmail(): string | null {
  const raw = process.env.ADMIN_EMAIL?.trim();
  return raw ? raw.toLowerCase() : null;
}

export function getAdminPassword(): string | null {
  const raw = process.env.ADMIN_PASSWORD?.trim();
  return raw || null;
}

export function getAdminEmails(): string[] {
  const seen = new Set<string>();
  const primary = getAdminEmail();
  if (primary) seen.add(primary);

  const extra = process.env.ADMIN_EMAILS?.trim();
  if (extra) {
    for (const e of extra.split(",")) {
      const trimmed = e.trim().toLowerCase();
      if (trimmed) seen.add(trimmed);
    }
  }

  return Array.from(seen);
}

export function isAdminLogin(login: string | null | undefined): boolean {
  if (!login) return false;
  return getAdminEmails().includes(login.toLowerCase());
}

/** @deprecated use isAdminLogin */
export const isAdminEmail = isAdminLogin;

export function isUserAdmin(user: {
  email: string | null;
  username: string | null;
  isAdmin?: boolean;
}): boolean {
  if (user.isAdmin) return true;
  return isAdminLogin(user.email) || isAdminLogin(user.username);
}

export async function countAdmins(exceptUserId?: string): Promise<number> {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, username: true, isAdmin: true },
  });
  return users.filter((u) => {
    if (exceptUserId && u.id === exceptUserId) return false;
    return isUserAdmin(u);
  }).length;
}

/** Persist isAdmin=true for env-listed admins that predate the DB column. */
export async function syncEnvAdminsToDb(): Promise<void> {
  for (const login of getAdminEmails()) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: login }, { username: login }],
      },
    });
    if (user && !user.isAdmin) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isAdmin: true, active: true },
      });
    }
  }
}

export async function syncEnvAdminFlag(userId: string, login: string) {
  if (!isAdminLogin(login)) return;
  await prisma.user.update({
    where: { id: userId },
    data: { isAdmin: true, active: true },
  });
}

export async function ensureAdminUser(): Promise<void> {
  const login = getAdminEmail();
  const password = getAdminPassword();
  if (!login || !password) return;

  const hash = await bcrypt.hash(password, 10);
  const name = process.env.ADMIN_NAME?.trim() || "Admin";
  const isEmail = login.includes("@");

  const existing = await prisma.user.findFirst({
    where: isEmail ? { email: login } : { username: login },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { password: hash, name, active: true, isAdmin: true },
    });
    return;
  }

  await prisma.user.create({
    data: {
      ...(isEmail ? { email: login } : { username: login }),
      name,
      password: hash,
      active: true,
      isAdmin: true,
    },
  });
}
