import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COLOR_SUGGESTIONS } from "@/lib/colors";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.frame.findMany({
    select: { color: true },
    distinct: ["color"],
  });

  const seen = new Map<string, string>();
  for (const r of rows) {
    seen.set(r.color.toLowerCase(), r.color);
  }
  for (const c of COLOR_SUGGESTIONS) {
    const key = c.toLowerCase();
    if (!seen.has(key)) seen.set(key, c);
  }

  const merged = Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  return NextResponse.json(merged);
}
