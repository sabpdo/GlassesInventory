import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const frameSchema = z.object({
  manufacturer: z.string().min(1, "Manufacturer is required"),
  style: z.string().min(1, "Style is required"),
  color: z.string().min(1, "Color is required"),
  description: z.string().min(1, "Description is required"),
  cost: z.coerce.number().nonnegative().default(0),
  retailCost: z.coerce.number().nonnegative().default(0),
  size: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/frames
//   ?sort=manufacturer|description
//   &dir=asc|desc
//   &q=foo                          full-text-ish search across all fields
//   &manufacturer=Ray-Ban,Oakley    one or more (comma separated)
//   &desc=RB3025                    descriptions starting with this prefix
//   &out=1                          include out-of-stock frames (default: hide)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sort = (searchParams.get("sort") ?? "manufacturer") as
    | "manufacturer"
    | "description";
  const dir = (searchParams.get("dir") ?? "asc") as "asc" | "desc";
  const q = searchParams.get("q")?.trim();
  const manufacturers =
    searchParams
      .get("manufacturer")
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const descPrefix = searchParams.get("desc")?.trim();
  const includeOutOfStock = searchParams.get("out") === "1";

  const orderBy: Record<string, "asc" | "desc">[] =
    sort === "description"
      ? [{ description: dir }, { manufacturer: "asc" }]
      : [{ manufacturer: dir }, { description: "asc" }];

  const conditions: Prisma.FrameWhereInput[] = [];
  if (!includeOutOfStock) {
    // "In stock" = at least one Item with status IN_STOCK.
    conditions.push({ items: { some: { status: "IN_STOCK" } } });
  }
  if (manufacturers.length > 0) {
    conditions.push({ manufacturer: { in: manufacturers } });
  }
  if (descPrefix) {
    conditions.push({
      description: { startsWith: descPrefix, mode: "insensitive" },
    });
  }
  if (q) {
    conditions.push({
      OR: [
        { manufacturer: { contains: q, mode: "insensitive" } },
        { style: { contains: q, mode: "insensitive" } },
        { color: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  const where: Prisma.FrameWhereInput | undefined = conditions.length
    ? { AND: conditions }
    : undefined;

  const frames = await prisma.frame.findMany({
    where,
    orderBy,
    include: {
      _count: { select: { items: { where: { status: "IN_STOCK" } } } },
    },
  });

  const result = frames.map((f) => ({
    id: f.id,
    manufacturer: f.manufacturer,
    style: f.style,
    color: f.color,
    description: f.description,
    cost: f.cost,
    retailCost: f.retailCost,
    size: f.size,
    notes: f.notes,
    inStock: f._count.items,
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = frameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const frame = await prisma.frame.create({
    data: { ...parsed.data, createdById: auth.userId },
  });
  return NextResponse.json(frame, { status: 201 });
}
