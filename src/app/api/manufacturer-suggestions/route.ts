import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COMMON_MANUFACTURERS } from "@/lib/manufacturers";

// Reads from the DB on every request — no static prerender.
export const dynamic = "force-dynamic";

// GET /api/manufacturer-suggestions
// Used by the New / Edit Frame form to power its <datalist> autocomplete.
// Returns the union of:
//   - distinct manufacturers already in the database (whatever the user has
//     typed in previous frames)
//   - a curated list of common eyewear brands (so suggestions are useful
//     from day one, before any frames exist)
// Deduped case-insensitively (preferring the casing already in the DB) and
// sorted alphabetically.
export async function GET() {
  const rows = await prisma.frame.findMany({
    select: { manufacturer: true },
    distinct: ["manufacturer"],
  });

  const seen = new Map<string, string>(); // key = lower, value = display
  for (const r of rows) {
    seen.set(r.manufacturer.toLowerCase(), r.manufacturer);
  }
  for (const m of COMMON_MANUFACTURERS) {
    const key = m.toLowerCase();
    if (!seen.has(key)) seen.set(key, m);
  }

  const merged = Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  return NextResponse.json(merged);
}
