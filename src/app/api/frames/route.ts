import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { resolveColor, resolveManufacturer } from "@/lib/resolve-labels";

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
    "manufacturer" | "description";
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
  const parsed = createFrameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { quantity, barcode, markSold, soldPrice, ...frameData } = parsed.data;

  frameData.manufacturer = await resolveManufacturer(
    prisma,
    frameData.manufacturer
  );
  frameData.color = await resolveColor(prisma, frameData.color);

  const frame = await prisma.frame.create({
    data: { ...frameData, createdById: auth.userId },
  });

  let firstItemId: string | null = null;

  if (barcode) {
    try {
      const item = await prisma.item.create({
        data: {
          barcode,
          frameId: frame.id,
          createdById: auth.userId,
        },
      });
      firstItemId = item.id;
    } catch (e) {
      await prisma.frame
        .delete({ where: { id: frame.id } })
        .catch(() => undefined);
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "That barcode is already attached to an item." },
          { status: 409 }
        );
      }
      throw e;
    }
  } else {
    const count = quantity > 0 ? quantity : markSold ? 1 : 0;
    if (count > 0) {
      if (count === 1) {
        const item = await prisma.item.create({
          data: { frameId: frame.id, createdById: auth.userId },
        });
        firstItemId = item.id;
      } else {
        await prisma.item.createMany({
          data: Array.from({ length: count }, () => ({
            frameId: frame.id,
            createdById: auth.userId,
          })),
        });
        const first = await prisma.item.findFirst({
          where: { frameId: frame.id },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        firstItemId = first?.id ?? null;
      }
    }
  }

  if (markSold && firstItemId) {
    await prisma.item.update({
      where: { id: firstItemId },
      data: {
        status: "SOLD",
        soldAt: new Date(),
        soldPrice: soldPrice ?? null,
        soldById: auth.userId,
      },
    });
  }

  const inStock = await prisma.item.count({
    where: { frameId: frame.id, status: "IN_STOCK" },
  });

  return NextResponse.json({ ...frame, inStock }, { status: 201 });
}
