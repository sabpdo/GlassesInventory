import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Reads from the DB on every request — no static prerender.
export const dynamic = "force-dynamic";

// GET /api/frames/manufacturers
// Distinct list, alphabetized, so the inventory filter dropdown stays stable
// even when the table is filtered.
export async function GET() {
  const rows = await prisma.frame.findMany({
    select: { manufacturer: true },
    distinct: ["manufacturer"],
    orderBy: { manufacturer: "asc" },
  });
  return NextResponse.json(rows.map((r) => r.manufacturer));
}
