import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const updateSchema = z.object({
  manufacturer: z.string().min(1),
  style: z.string().min(1),
  color: z.string().min(1),
  description: z.string().min(1),
  cost: z.coerce.number().nonnegative(),
  retailCost: z.coerce.number().nonnegative(),
  size: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type RouteParams = { params: { id: string } };

export async function GET(_req: Request, { params }: RouteParams) {
  const frame = await prisma.frame.findUnique({
    where: { id: params.id },
    include: {
      items: { orderBy: { createdAt: "desc" } },
      _count: { select: { items: { where: { status: "IN_STOCK" } } } },
    },
  });
  if (!frame) {
    return NextResponse.json({ error: "Frame not found" }, { status: 404 });
  }
  return NextResponse.json({
    ...frame,
    inStock: frame._count.items,
  });
}

export async function PUT(req: Request, { params }: RouteParams) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const frame = await prisma.frame.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return NextResponse.json(frame);
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  // Refuse to silently destroy sales history. The client may pass
  // ?force=1 if the user explicitly confirms they want sold rows gone too.
  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "1";

  const soldCount = await prisma.item.count({
    where: { frameId: params.id, status: "SOLD" },
  });
  if (soldCount > 0 && !force) {
    return NextResponse.json(
      {
        error: `This frame has ${soldCount} sold item(s). Deleting it would erase that sales history. Pass force=1 to confirm.`,
        soldCount,
      },
      { status: 409 }
    );
  }

  await prisma.frame.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
