import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: { code: string } };

// GET /api/pair/:code?since=<iso>
// Desktop polls this. Returns the latest barcode if newer than `since`.
export async function GET(req: Request, { params }: RouteParams) {
  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");
  const sinceDate = since ? new Date(since) : null;

  const session = await prisma.pairingSession.findUnique({
    where: { code: params.code.toUpperCase() },
  });
  if (!session) {
    return NextResponse.json({ error: "Pair code not found" }, { status: 404 });
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
    lastBarcode: hasNew ? session.lastBarcode : null,
    lastBarcodeAt: session.lastBarcodeAt?.toISOString() ?? null,
  });
}
