import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isUserAdmin, syncEnvAdminsToDb } from "@/lib/admin";
import { requireAdmin } from "@/lib/session";
import { getUserLogin, loginTaken, parseLoginInput } from "@/lib/users";

const createSchema = z.object({
  login: z.string().trim().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
  name: z.string().trim().optional(),
});

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

// GET /api/admin/users — list users for the access panel.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  await syncEnvAdminsToDb();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: userSelect,
  });

  return NextResponse.json(users.map(serializeUser));
}

// POST /api/admin/users — admin creates a whitelisted account.
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { login, password, name } = parsed.data;
  const loginFields = parseLoginInput(login);
  if (!loginFields.ok) {
    return NextResponse.json({ error: loginFields.error }, { status: 400 });
  }

  if (await loginTaken(login)) {
    return NextResponse.json(
      { error: "An account with that email or username already exists." },
      { status: 409 }
    );
  }

  const user = await prisma.user.create({
    data: {
      email: loginFields.email ?? null,
      username: loginFields.username ?? null,
      name: name || null,
      password: await bcrypt.hash(password, 10),
      active: true,
    },
    select: userSelect,
  });

  return NextResponse.json(serializeUser(user), { status: 201 });
}
