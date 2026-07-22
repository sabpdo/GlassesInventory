import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { frameLabel } from "@/lib/inventory-events";
import {
  buildTrend,
  computePeriodStats,
  countInStockAt,
  parseStatsRange,
} from "@/lib/inventory-stats";
import { getUserDisplayName } from "@/lib/users";
import { requireUser } from "@/lib/session";

type DeletionRow = {
  id: string;
  kind: string;
  occurredAt: string;
  actorName: string | null;
  label: string;
  barcode: string | null;
  stockRemoved: number;
};

function stockRemovedFromEvent(e: {
  kind: string;
  itemStatus: string | null;
  inStockCount: number | null;
}): number {
  if (e.kind === "ITEM_DELETED" && e.itemStatus === "IN_STOCK") return 1;
  if (e.kind === "FRAME_DELETED") return e.inStockCount ?? 0;
  return 0;
}

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from")?.trim();
  if (!from) {
    return NextResponse.json(
      { error: "from=YYYY-MM-DD is required." },
      { status: 400 }
    );
  }

  const parsed = parseStatsRange(from, searchParams.get("to"));
  if (!parsed) {
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
  }

  const { rangeStart, rangeEnd, fromLabel, toLabel } = parsed;

  const [items, frameCount, framesInStock, deletionEvents] = await Promise.all([
    prisma.item.findMany({
      select: { createdAt: true, soldAt: true, soldPrice: true },
    }),
    prisma.frame.count(),
    prisma.frame.count({
      where: { items: { some: { status: "IN_STOCK" } } },
    }),
    prisma.inventoryEvent.findMany({
      where: { occurredAt: { gte: rangeStart, lte: rangeEnd } },
      include: {
        actor: { select: { name: true, email: true, username: true } },
      },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  const events = items.map((i) => ({
    createdAt: i.createdAt,
    soldAt: i.soldAt,
    soldPrice: i.soldPrice,
  }));

  const now = new Date();
  const inStockNow = countInStockAt(events, now);
  const soldAllTime = items.filter((i) => i.soldAt !== null).length;

  let trend;
  try {
    trend = buildTrend(events, rangeStart, rangeEnd);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const base = computePeriodStats(events, rangeStart, rangeEnd);
  const stockRemoved = deletionEvents.reduce(
    (sum, e) => sum + stockRemovedFromEvent(e),
    0
  );
  const itemsDeleted = deletionEvents.filter(
    (e) => e.kind === "ITEM_DELETED"
  ).length;
  const framesDeleted = deletionEvents.filter(
    (e) => e.kind === "FRAME_DELETED"
  ).length;
  const adjustedNetExpected = base.netExpected - stockRemoved;
  const adjustedUnaccounted = base.inventoryEnd - adjustedNetExpected;

  const deletions: DeletionRow[] = deletionEvents.map((e) => ({
    id: e.id,
    kind: e.kind,
    occurredAt: e.occurredAt.toISOString(),
    actorName: e.actor ? getUserDisplayName(e.actor) : null,
    label: frameLabel({
      manufacturer: e.manufacturer ?? "Unknown",
      style: e.style ?? "—",
      color: e.color ?? "—",
      description: e.description,
    }),
    barcode: e.barcode,
    stockRemoved: stockRemovedFromEvent(e),
  }));

  return NextResponse.json({
    current: {
      inStock: inStockNow,
      frameStyles: frameCount,
      frameStylesInStock: framesInStock,
      pairsTracked: items.length,
      soldAllTime,
    },
    range: { from: fromLabel, to: toLabel },
    period: {
      ...base,
      stockRemoved,
      itemsDeleted,
      framesDeleted,
      adjustedNetExpected,
      adjustedUnaccounted,
    },
    deletions,
    trend,
  });
}
