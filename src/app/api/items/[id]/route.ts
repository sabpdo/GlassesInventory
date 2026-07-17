import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const patchSchema = z.object({
  status: z.enum(["IN_STOCK"]).optional(),
  soldPrice: z.coerce.number().nonnegative().optional().nullable(),
});

type RouteParams = { params: { id: string } };

// PATCH /api/items/:id — mark unsold or update sold price.
export async function PATCH(req: Request, { params }: RouteParams) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const item = await prisma.item.findUnique({ where: { id: params.id } });
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { status, soldPrice } = parsed.data;

  if (status === "IN_STOCK") {
    if (item.status !== "SOLD") {
      return NextResponse.json({ error: "Item is not sold." }, { status: 409 });
    }
    const updated = await prisma.item.update({
      where: { id: params.id },
      data: {
        status: "IN_STOCK",
        soldAt: null,
        soldPrice: null,
        soldById: null,
      },
    });
    return NextResponse.json(updated);
  }

  if (soldPrice !== undefined) {
    if (item.status !== "SOLD") {
      return NextResponse.json(
        { error: "Sold price can only be set on sold items." },
        { status: 409 }
      );
    }
    const updated = await prisma.item.update({
      where: { id: params.id },
      data: { soldPrice },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "No changes provided." }, { status: 400 });
}

// DELETE /api/items/:id — remove a single item.
export async function DELETE(_req: Request, { params }: RouteParams) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    await prisma.item.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    throw e;
  }
}
