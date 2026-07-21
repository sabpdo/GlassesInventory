import type { Prisma, PrismaClient } from "@prisma/client";

export type FrameMatchInput = {
  manufacturer: string;
  style: string;
  color: string;
  description: string | null;
  size: string | null;
};

function optionalTextWhere(
  field: "description" | "size",
  value: string | null
): Prisma.FrameWhereInput {
  const trimmed = value?.trim() || null;
  if (!trimmed) {
    return { OR: [{ [field]: null }, { [field]: "" }] };
  }
  return { [field]: { equals: trimmed, mode: "insensitive" } };
}

/** Find an existing frame with the same identity (vendor, style, color, description, size). */
export async function findMatchingFrame(
  prisma: PrismaClient,
  input: FrameMatchInput
) {
  const manufacturer = input.manufacturer.trim();
  const style = input.style.trim();
  const color = input.color.trim();
  if (!manufacturer || !style || !color) return null;

  return prisma.frame.findFirst({
    where: {
      AND: [
        { manufacturer: { equals: manufacturer, mode: "insensitive" } },
        { style: { equals: style, mode: "insensitive" } },
        { color: { equals: color, mode: "insensitive" } },
        optionalTextWhere("description", input.description),
        optionalTextWhere("size", input.size),
      ],
    },
    include: {
      _count: { select: { items: { where: { status: "IN_STOCK" } } } },
    },
  });
}
