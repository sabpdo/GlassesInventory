import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const sellSchema = z.object({
  soldPrice: z.coerce.number().nonnegative().optional(),
});

type RouteParams = { params: { id: string } };

export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const parsed = sellSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Race-safe sell: only flip the row if it's still IN_STOCK at the moment
  // of the UPDATE. Two parallel sellers can't both succeed.
  const soldAt = new Date();
  const update = await prisma.item.updateMany({
    where: { id: params.id, status: "IN_STOCK" },
    data: {
      status: "SOLD",
      soldAt,
      soldPrice: parsed.data.soldPrice,
      soldById: auth.userId,
    },
  });

  if (update.count === 0) {
    // Either the item doesn't exist, or it was already sold (potentially
    // by another user that beat us by a millisecond).
    const existing = await prisma.item.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Item is already marked as sold." },
      { status: 409 }
    );
  }

  const item = await prisma.item.findUnique({
    where: { id: params.id },
    include: { frame: true, soldBy: { select: { name: true, email: true } } },
  });
  return NextResponse.json(item);
}
