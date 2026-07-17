import type { PrismaClient } from "@prisma/client";
import { COLOR_SUGGESTIONS } from "@/lib/colors";
import { COMMON_MANUFACTURERS } from "@/lib/manufacturers";
import { normalizeLabel } from "@/lib/normalize-label";

async function distinctManufacturers(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.frame.findMany({
    select: { manufacturer: true },
    distinct: ["manufacturer"],
  });
  return rows.map((r) => r.manufacturer);
}

async function distinctColors(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.frame.findMany({
    select: { color: true },
    distinct: ["color"],
  });
  return rows.map((r) => r.color);
}

export async function resolveManufacturer(
  prisma: PrismaClient,
  raw: string
): Promise<string> {
  const db = await distinctManufacturers(prisma);
  const known = [...db, ...COMMON_MANUFACTURERS];
  return normalizeLabel(raw, known);
}

export async function resolveColor(
  prisma: PrismaClient,
  raw: string
): Promise<string> {
  const db = await distinctColors(prisma);
  const known = [...db, ...COLOR_SUGGESTIONS];
  return normalizeLabel(raw, known);
}
