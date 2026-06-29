import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePairingCode, PAIRING_TTL_MS } from "@/lib/pairing";
import { requireUser } from "@/lib/session";

// POST /api/pair  →  desktop creates a pairing session.
// Auth required: only logged-in users should be able to mint pair codes.
// (The /api/pair/[code]/scan endpoint that the phone hits intentionally
// stays public — the short pair code is the auth token there.)
export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  // Best-effort cleanup so the table doesn't grow forever.
  await prisma.pairingSession
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => undefined);

  // Retry on the (vanishingly rare) code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generatePairingCode();
    try {
      const session = await prisma.pairingSession.create({
        data: {
          code,
          expiresAt: new Date(Date.now() + PAIRING_TTL_MS),
        },
      });
      return NextResponse.json({
        code: session.code,
        expiresAt: session.expiresAt.toISOString(),
      });
    } catch {
      // collision — try again
    }
  }
  return NextResponse.json(
    { error: "Could not create pairing session" },
    { status: 500 }
  );
}
