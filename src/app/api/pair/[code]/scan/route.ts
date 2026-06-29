import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({ barcode: z.string().min(1) });

type RouteParams = { params: { code: string } };

// POST /api/pair/:code/scan  →  phone sends a barcode to the paired desktop.
export async function POST(req: Request, { params }: RouteParams) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const code = params.code.toUpperCase();
  const session = await prisma.pairingSession.findUnique({ where: { code } });
  if (!session) {
    return NextResponse.json({ error: "Pair code not found" }, { status: 404 });
  }
  if (session.expiresAt < new Date()) {
    return NextResponse.json({ error: "Pair code expired" }, { status: 410 });
  }

  await prisma.pairingSession.update({
    where: { code },
    data: {
      lastBarcode: parsed.data.barcode.trim(),
      lastBarcodeAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
