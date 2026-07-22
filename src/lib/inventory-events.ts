import type { PrismaClient } from "@prisma/client";

export type InventoryEventKind = "ITEM_DELETED" | "FRAME_DELETED";

export function frameLabel(parts: {
  manufacturer: string;
  style: string;
  color: string;
  description?: string | null;
}): string {
  const base = `${parts.manufacturer} · ${parts.style} · ${parts.color}`;
  return parts.description?.trim()
    ? `${base} · ${parts.description.trim()}`
    : base;
}

export async function logItemDeleted(
  prisma: PrismaClient,
  actorId: string,
  item: {
    id: string;
    barcode: string | null;
    status: string;
    frameId: string;
    frame: {
      manufacturer: string;
      style: string;
      color: string;
      description: string | null;
    };
  }
) {
  await prisma.inventoryEvent.create({
    data: {
      kind: "ITEM_DELETED",
      actorId,
      itemId: item.id,
      frameId: item.frameId,
      barcode: item.barcode,
      itemStatus: item.status,
      manufacturer: item.frame.manufacturer,
      style: item.frame.style,
      color: item.frame.color,
      description: item.frame.description,
    },
  });
}

export async function logFrameDeleted(
  prisma: PrismaClient,
  actorId: string,
  frame: {
    id: string;
    manufacturer: string;
    style: string;
    color: string;
    description: string | null;
  },
  counts: { inStock: number; sold: number }
) {
  await prisma.inventoryEvent.create({
    data: {
      kind: "FRAME_DELETED",
      actorId,
      frameId: frame.id,
      manufacturer: frame.manufacturer,
      style: frame.style,
      color: frame.color,
      description: frame.description,
      inStockCount: counts.inStock,
      soldCount: counts.sold,
    },
  });
}
