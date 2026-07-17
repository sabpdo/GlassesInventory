import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { countAdmins, isUserAdmin } from "@/lib/admin";
import { requireAdmin } from "@/lib/session";
import {
  getUserLogin,
  loginTaken,
  normalizeLogin,
  parseLoginInput,
} from "@/lib/users";

const userSelect = {
  id: true,
  email: true,
  username: true,
  name: true,
  active: true,
  isAdmin: true,
  createdAt: true,
} as const;

function serializeUser(user: {
  id: string;
  email: string | null;
  username: string | null;
  name: string | null;
  active: boolean;
  isAdmin: boolean;
  createdAt: Date;
}) {
  return {
    ...user,
    login: getUserLogin(user),
    isAdmin: isUserAdmin(user),
    createdAt: user.createdAt.toISOString(),
  };
}

const patchSchema = z
  .object({
    active: z.boolean().optional(),
    login: z.string().trim().min(1).optional(),
    password: z.string().min(1).optional(),
    name: z.string().trim().optional(),
    isAdmin: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.active !== undefined ||
      data.login !== undefined ||
      data.password !== undefined ||
      data.name !== undefined ||
      data.isAdmin !== undefined,
    { message: "No changes provided." }
  );

type RouteParams = { params: { id: string } };

// PATCH /api/admin/users/:id — update account.
export async function PATCH(req: Request, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { active, login, password, name, isAdmin } = parsed.data;

  if (active === false) {
    if (isUserAdmin(target)) {
      return NextResponse.json(
        { error: "Admin accounts cannot be revoked." },
        { status: 403 }
      );
    }
    if (target.id === auth.userId) {
      return NextResponse.json(
        { error: "You cannot revoke your own account." },
        { status: 403 }
      );
    }
  }

  if (isAdmin === false) {
    if (target.id === auth.userId) {
      return NextResponse.json(
        { error: "You cannot remove your own admin access." },
        { status: 403 }
      );
    }
    const remaining = await countAdmins(target.id);
    if (remaining === 0) {
      return NextResponse.json(
        { error: "At least one admin is required." },
        { status: 403 }
      );
    }
  }

  const data: {
    active?: boolean;
    email?: string | null;
    username?: string | null;
    password?: string;
    name?: string | null;
    isAdmin?: boolean;
  } = {};

  if (active !== undefined) data.active = active;
  if (name !== undefined) data.name = name || null;
  if (isAdmin !== undefined) data.isAdmin = isAdmin;

  if (password !== undefined) {
    data.password = await bcrypt.hash(password, 10);
  }

  if (login !== undefined) {
    const currentLogin = normalizeLogin(getUserLogin(target));
    const nextLogin = normalizeLogin(login);
    if (nextLogin !== currentLogin) {
      const loginFields = parseLoginInput(login);
      if (!loginFields.ok) {
        return NextResponse.json({ error: loginFields.error }, { status: 400 });
      }
      if (await loginTaken(login, target.id)) {
        return NextResponse.json(
          { error: "An account with that email or username already exists." },
          { status: 409 }
        );
      }
      if (loginFields.email) {
        data.email = loginFields.email;
        data.username = null;
      } else {
        data.username = loginFields.username ?? null;
        data.email = null;
      }
    }
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: userSelect,
  });

  return NextResponse.json(serializeUser(user));
}

// DELETE /api/admin/users/:id — permanently remove an account.
export async function DELETE(_req: Request, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (target.id === auth.userId) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 403 }
    );
  }

  if (isUserAdmin(target)) {
    return NextResponse.json(
      { error: "Remove admin access before deleting this account." },
      { status: 403 }
    );
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
