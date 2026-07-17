import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FrameDetail } from "@/components/FrameDetail";
import { getUserDisplayName } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function FramePage({
  params,
}: {
  params: { id: string };
}) {
  const frame = await prisma.frame.findUnique({
    where: { id: params.id },
    include: {
      items: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { name: true, email: true, username: true } },
          soldBy: { select: { name: true, email: true, username: true } },
        },
      },
      _count: { select: { items: { where: { status: "IN_STOCK" } } } },
    },
  });
  if (!frame) notFound();

  const data = {
    id: frame.id,
    manufacturer: frame.manufacturer,
    style: frame.style,
    color: frame.color,
    description: frame.description,
    cost: frame.cost,
    retailCost: frame.retailCost,
    size: frame.size,
    notes: frame.notes,
    inStock: frame._count.items,
    items: frame.items.map((i) => ({
      id: i.id,
      barcode: i.barcode,
      status: i.status,
      soldAt: i.soldAt ? i.soldAt.toISOString() : null,
      soldPrice: i.soldPrice,
      createdAt: i.createdAt.toISOString(),
      createdByName: displayUser(i.createdBy),
      soldByName: displayUser(i.soldBy),
    })),
  };

  return <FrameDetail frame={data} />;
}

function displayUser(
  u:
    | { name: string | null; email: string | null; username: string | null }
    | null
    | undefined
): string | null {
  if (!u) return null;
  return getUserDisplayName(u);
}
