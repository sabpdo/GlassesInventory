import { prisma } from "@/lib/prisma";

const USERNAME_RE = /^[a-z0-9._-]+$/;

export function normalizeLogin(value: string): string {
  return value.trim().toLowerCase();
}

export function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

export function parseLoginInput(
  raw: string
):
  | { ok: true; email?: string; username?: string }
  | { ok: false; error: string } {
  const value = normalizeLogin(raw);
  if (value.length < 3) {
    return { ok: false, error: "Login must be at least 3 characters." };
  }

  if (looksLikeEmail(value)) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return { ok: false, error: "Enter a valid email address." };
    }
    return { ok: true, email: value };
  }

  if (value.length > 32) {
    return { ok: false, error: "Username must be at most 32 characters." };
  }
  if (!USERNAME_RE.test(value)) {
    return {
      ok: false,
      error:
        "Username can only use letters, numbers, dots, dashes, and underscores.",
    };
  }
  return { ok: true, username: value };
}

export function getUserLogin(user: {
  email: string | null;
  username: string | null;
}): string {
  return user.email ?? user.username ?? "";
}

export function getUserDisplayName(user: {
  name: string | null;
  email: string | null;
  username: string | null;
}): string {
  if (user.name?.trim()) return user.name.trim();
  if (user.username) return user.username;
  if (user.email) return user.email.split("@")[0];
  return "User";
}

export function getUserInitials(user: {
  name: string | null;
  email: string | null;
  username: string | null;
}): string {
  const source = getUserDisplayName(user);
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export async function findUserByLogin(login: string) {
  const normalized = normalizeLogin(login);
  return prisma.user.findFirst({
    where: {
      OR: [{ email: normalized }, { username: normalized }],
    },
  });
}

export async function loginTaken(
  login: string,
  exceptUserId?: string
): Promise<boolean> {
  const user = await findUserByLogin(login);
  if (!user) return false;
  if (exceptUserId && user.id === exceptUserId) return false;
  return true;
}
