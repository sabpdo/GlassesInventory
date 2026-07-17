import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: { barcode: string } };

export async function GET(_req: Request, { params }: RouteParams) {
  const barcode = decodeURIComponent(params.barcode).trim();
  if (!barcode) {
    return NextResponse.json({ error: "Barcode required" }, { status: 400 });
  }

  const item = await prisma.item.findUnique({
    where: { barcode },
    include: { frame: true },
  });
  if (!item) {
    return NextResponse.json({ found: false, barcode });
  }

  const inStock = await prisma.item.count({
    where: { frameId: item.frameId, status: "IN_STOCK" },
  });

  return NextResponse.json({
    found: true,
    item: {
      ...item,
      frame: { ...item.frame, inStock },
    },
  });
}
