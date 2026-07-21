import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { resolveColor, resolveManufacturer } from "@/lib/resolve-labels";
import { findMatchingFrame } from "@/lib/match-frame";
import { addFrameInventory, InventoryError } from "@/lib/frame-inventory";
import {
  defaultSortDir,
  type FrameSortField,
  isFrameSortField,
} from "@/lib/frame-sort";

const frameSchema = z.object({
  manufacturer: z.string().min(1, "Manufacturer is required"),
  style: z.string().min(1, "Style is required"),
  color: z.string().min(1, "Color is required"),
  description: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => v || null),
  cost: z.coerce.number().nonnegative().default(0),
  retailCost: z.coerce.number().nonnegative().default(0),
  size: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const createFrameSchema = frameSchema.extend({
  quantity: z.coerce.number().int().min(0).max(100).default(0),
  barcode: z.string().trim().min(1).optional().nullable(),
  markSold: z.boolean().optional().default(false),
  soldPrice: z.coerce.number().nonnegative().optional().nullable(),
  confirmDuplicate: z.boolean().optional().default(false),
  addToExistingFrameId: z.string().optional(),
});

function buildOrderBy(
  sort: FrameSortField,
  dir: "asc" | "desc"
): Record<string, "asc" | "desc">[] {
  switch (sort) {
    case "style":
      return [{ style: dir }, { manufacturer: "asc" }];
    case "color":
      return [{ color: dir }, { manufacturer: "asc" }];
    case "description":
      return [{ description: dir }, { manufacturer: "asc" }];
    case "cost":
      return [{ cost: dir }, { manufacturer: "asc" }];
    case "retailCost":
      return [{ retailCost: dir }, { manufacturer: "asc" }];
    case "size":
      return [{ size: dir }, { manufacturer: "asc" }];
    case "createdAt":
      return [{ createdAt: dir }];
    case "inStock":
      return [{ manufacturer: "asc" }];
    default:
      return [{ manufacturer: dir }, { style: "asc" }];
  }
}

// GET /api/frames
//   ?sort=manufacturer|style|color|description|cost|retailCost|size|inStock|createdAt
//   &dir=asc|desc
//   &q=foo                          full-text-ish search across all fields
//   &manufacturer=Ray-Ban,Oakley    one or more (comma separated)
//   &desc=RB3025                    descriptions starting with this prefix
//   &out=1                          include out-of-stock frames (default: hide)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sortParam = searchParams.get("sort") ?? "manufacturer";
  const sort: FrameSortField = isFrameSortField(sortParam)
    ? sortParam
    : "manufacturer";
  const dir = (searchParams.get("dir") ?? defaultSortDir(sort)) as
    "asc" | "desc";
  const q = searchParams.get("q")?.trim();
  const manufacturers =
    searchParams
      .get("manufacturer")
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const colors =
    searchParams
      .get("color")
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const descPrefix = searchParams.get("desc")?.trim();
  const includeOutOfStock = searchParams.get("out") === "1";

  const orderBy = buildOrderBy(sort, dir);

  const conditions: Prisma.FrameWhereInput[] = [];
  if (!includeOutOfStock) {
    // "In stock" = at least one Item with status IN_STOCK.
    conditions.push({ items: { some: { status: "IN_STOCK" } } });
  }
  if (manufacturers.length > 0) {
    conditions.push({ manufacturer: { in: manufacturers } });
  }
  if (colors.length > 0) {
    conditions.push({
      OR: colors.map((color) => ({
        color: { equals: color, mode: "insensitive" as const },
      })),
    });
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

  let result = frames.map((f) => ({
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
    createdAt: f.createdAt.toISOString(),
  }));

  if (sort === "inStock") {
    result = [...result].sort((a, b) =>
      dir === "asc" ? a.inStock - b.inStock : b.inStock - a.inStock
    );
  }

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = createFrameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const {
    quantity,
    barcode,
    markSold,
    soldPrice,
    confirmDuplicate,
    addToExistingFrameId,
    ...frameData
  } = parsed.data;

  frameData.manufacturer = await resolveManufacturer(
    prisma,
    frameData.manufacturer
  );
  frameData.color = await resolveColor(prisma, frameData.color);

  const inventoryInput = {
    quantity,
    barcode: barcode ?? null,
    markSold,
    soldPrice: soldPrice ?? null,
  };

  if (addToExistingFrameId) {
    const existing = await prisma.frame.findUnique({
      where: { id: addToExistingFrameId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Frame not found." }, { status: 404 });
    }
    try {
      const inStock = await addFrameInventory(
        prisma,
        existing.id,
        auth.userId,
        inventoryInput
      );
      return NextResponse.json({ ...existing, inStock }, { status: 200 });
    } catch (e) {
      if (e instanceof InventoryError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }
  }

  if (!confirmDuplicate) {
    const match = await findMatchingFrame(prisma, {
      manufacturer: frameData.manufacturer,
      style: frameData.style,
      color: frameData.color,
      description: frameData.description ?? null,
      size: frameData.size ?? null,
    });
    if (match) {
      return NextResponse.json(
        {
          error: "A matching frame already exists in inventory.",
          duplicate: true,
          existingFrame: {
            id: match.id,
            manufacturer: match.manufacturer,
            style: match.style,
            color: match.color,
            description: match.description,
            size: match.size,
            inStock: match._count.items,
          },
        },
        { status: 409 }
      );
    }
  }

  const frame = await prisma.frame.create({
    data: { ...frameData, createdById: auth.userId },
  });

  let inStock = 0;
  try {
    inStock = await addFrameInventory(
      prisma,
      frame.id,
      auth.userId,
      inventoryInput
    );
  } catch (e) {
    await prisma.frame
      .delete({ where: { id: frame.id } })
      .catch(() => undefined);
    if (e instanceof InventoryError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  return NextResponse.json({ ...frame, inStock }, { status: 201 });
}
