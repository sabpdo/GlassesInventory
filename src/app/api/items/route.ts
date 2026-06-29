import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

// Two modes:
//   1. barcode supplied  → create one Item with that barcode (quantity ignored)
//   2. barcode omitted   → create `quantity` items with null barcode
const createSchema = z
  .object({
    barcode: z
      .string()
      .trim()
      .min(1)
      .optional()
      .nullable(),
    frameId: z.string().min(1, "Frame is required"),
    quantity: z.coerce.number().int().min(1).max(100).default(1),
  })
  .refine(
    (v) => v.barcode || v.quantity >= 1,
    "Provide either a barcode or a quantity."
  );

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { barcode, frameId, quantity } = parsed.data;

  const frame = await prisma.frame.findUnique({ where: { id: frameId } });
  if (!frame) {
    return NextResponse.json({ error: "Frame not found" }, { status: 404 });
  }

  if (barcode) {
    try {
      const item = await prisma.item.create({
        data: { barcode, frameId, createdById: auth.userId },
        include: { frame: true },
      });
      return NextResponse.json(item, { status: 201 });
    } catch (e) {
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
  }

  // Unbarcoded: bulk-insert `quantity` items.
  const result = await prisma.item.createMany({
    data: Array.from({ length: quantity }, () => ({
      frameId,
      barcode: null,
      createdById: auth.userId,
    })),
  });
  return NextResponse.json(
    { created: result.count, withoutBarcode: true },
    { status: 201 }
  );
}
