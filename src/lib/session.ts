import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export type AuthCheck =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse };

// Defense-in-depth helper for API routes. The middleware already gates
// almost everything, but invoking this inside each route handler means
// we never accidentally accept an unauthenticated mutation when the route
// is added to the middleware allowlist (e.g. /api/pair).
export async function requireUser(): Promise<AuthCheck> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const email = session?.user?.email;
  if (!userId || !email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, userId, email };
}
