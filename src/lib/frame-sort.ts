export const FRAME_SORT_FIELDS = [
  "manufacturer",
  "style",
  "color",
  "description",
  "cost",
  "retailCost",
  "size",
  "inStock",
  "createdAt",
] as const;

export type FrameSortField = (typeof FRAME_SORT_FIELDS)[number];

export function isFrameSortField(value: string): value is FrameSortField {
  return (FRAME_SORT_FIELDS as readonly string[]).includes(value);
}

export function defaultSortDir(field: FrameSortField): "asc" | "desc" {
  return field === "createdAt" ? "desc" : "asc";
}
