import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

type RouteParams = { params: { code: string } };

function normalizeCode(raw: string): string {
  return raw.toUpperCase();
}

// GET /api/pair/:code?since=<iso>
// Desktop polls this. Returns the latest barcode if newer than `since`.
// The phone also polls (without `since`) to detect when the desktop ends
// the session — a deleted row returns 404.
export async function GET(req: Request, { params }: RouteParams) {
  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");
  const sinceDate = since ? new Date(since) : null;

  const session = await prisma.pairingSession.findUnique({
    where: { code: normalizeCode(params.code) },
  });
  if (!session) {
    return NextResponse.json(
      { error: "Pairing ended on the computer." },
      { status: 404 }
    );
  }
  if (session.expiresAt < new Date()) {
    return NextResponse.json({ error: "Pair code expired" }, { status: 410 });
  }

  const hasNew =
    session.lastBarcode &&
    session.lastBarcodeAt &&
    (!sinceDate || session.lastBarcodeAt > sinceDate);

  return NextResponse.json({
    code: session.code,
    expiresAt: session.expiresAt.toISOString(),
    active: true,
    lastBarcode: hasNew ? session.lastBarcode : null,
    lastBarcodeAt: session.lastBarcodeAt?.toISOString() ?? null,
  });
}

// DELETE /api/pair/:code
// Desktop ends pairing — deletes the session so the phone page stops too.
export async function DELETE(_req: Request, { params }: RouteParams) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  await prisma.pairingSession.deleteMany({
    where: { code: normalizeCode(params.code) },
  });
  return NextResponse.json({ ok: true });
}
