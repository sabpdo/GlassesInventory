import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

type InventoryInput = {
  quantity: number;
  barcode: string | null;
  markSold: boolean;
  soldPrice: number | null;
};

export async function addFrameInventory(
  prisma: PrismaClient,
  frameId: string,
  userId: string,
  { quantity, barcode, markSold, soldPrice }: InventoryInput
) {
  let firstItemId: string | null = null;

  if (barcode) {
    try {
      const item = await prisma.item.create({
        data: { barcode, frameId, createdById: userId },
      });
      firstItemId = item.id;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new InventoryError(
          "That barcode is already attached to an item.",
          409
        );
      }
      throw e;
    }
  } else {
    const count = quantity > 0 ? quantity : markSold ? 1 : 0;
    if (count > 0) {
      if (count === 1) {
        const item = await prisma.item.create({
          data: { frameId, createdById: userId },
        });
        firstItemId = item.id;
      } else {
        await prisma.item.createMany({
          data: Array.from({ length: count }, () => ({
            frameId,
            createdById: userId,
          })),
        });
        const first = await prisma.item.findFirst({
          where: { frameId },
          orderBy: { createdAt: "desc" },
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
        soldPrice,
        soldById: userId,
      },
    });
  }

  return prisma.item.count({
    where: { frameId, status: "IN_STOCK" },
  });
}

export class InventoryError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}
