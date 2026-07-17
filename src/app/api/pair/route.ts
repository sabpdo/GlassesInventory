import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppOrigin } from "@/lib/app-url";
import { generatePairingCode, PAIRING_TTL_MS } from "@/lib/pairing";
import { requireUser } from "@/lib/session";

// POST /api/pair  →  desktop creates a pairing session.
export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  await prisma.pairingSession
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => undefined);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generatePairingCode();
    try {
      const session = await prisma.pairingSession.create({
        data: {
          code,
          expiresAt: new Date(Date.now() + PAIRING_TTL_MS),
        },
      });
      const appOrigin = getAppOrigin();
      return NextResponse.json({
        code: session.code,
        expiresAt: session.expiresAt.toISOString(),
        appOrigin,
        pairUrl: `${appOrigin}/p/${session.code}`,
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
