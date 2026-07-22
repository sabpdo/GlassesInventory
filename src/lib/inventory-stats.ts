import { parseDateParam, formatDateInput } from "@/lib/csv";

export type ItemEvent = {
  createdAt: Date;
  soldAt: Date | null;
  soldPrice: number | null;
};

export function wasInStockAt(item: ItemEvent, at: Date): boolean {
  return (
    item.createdAt.getTime() <= at.getTime() &&
    (item.soldAt === null || item.soldAt.getTime() > at.getTime())
  );
}

export function countInStockAt(items: ItemEvent[], at: Date): number {
  return items.filter((i) => wasInStockAt(i, at)).length;
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return formatDateInput(d);
}

export function eachDayUtc(from: Date, to: Date): string[] {
  const days: string[] = [];
  const cur = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  );
  const end = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  );
  while (cur.getTime() <= end.getTime()) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

export type PeriodStats = {
  inventoryStart: number;
  inventoryEnd: number;
  added: number;
  sold: number;
  soldRevenue: number;
  netExpected: number;
  /** End inventory minus (start + added − sold). Negative ≈ missing/deleted. */
  unaccounted: number;
};

export function computePeriodStats(
  items: ItemEvent[],
  rangeStart: Date,
  rangeEnd: Date
): PeriodStats {
  const inventoryStart = countInStockAt(items, rangeStart);
  const inventoryEnd = countInStockAt(items, rangeEnd);
  const added = items.filter(
    (i) =>
      i.createdAt.getTime() >= rangeStart.getTime() &&
      i.createdAt.getTime() <= rangeEnd.getTime()
  ).length;
  const soldItems = items.filter(
    (i) =>
      i.soldAt &&
      i.soldAt.getTime() >= rangeStart.getTime() &&
      i.soldAt.getTime() <= rangeEnd.getTime()
  );
  const sold = soldItems.length;
  const soldRevenue = soldItems.reduce((sum, i) => sum + (i.soldPrice ?? 0), 0);
  const netExpected = inventoryStart + added - sold;
  const unaccounted = inventoryEnd - netExpected;

  return {
    inventoryStart,
    inventoryEnd,
    added,
    sold,
    soldRevenue,
    netExpected,
    unaccounted,
  };
}

export type TrendPoint = {
  date: string;
  inventory: number;
  added: number;
  sold: number;
  soldRevenue: number;
};

const MAX_TREND_DAYS = 366;

export function buildTrend(
  items: ItemEvent[],
  rangeStart: Date,
  rangeEnd: Date
): TrendPoint[] {
  const days = eachDayUtc(rangeStart, rangeEnd);
  if (days.length > MAX_TREND_DAYS) {
    throw new Error(`Date range too large (max ${MAX_TREND_DAYS} days).`);
  }

  return days.map((day) => {
    const dayStart = parseDateParam(day, false)!;
    const dayEnd = parseDateParam(day, true)!;
    const soldItems = items.filter(
      (i) =>
        i.soldAt &&
        i.soldAt.getTime() >= dayStart.getTime() &&
        i.soldAt.getTime() <= dayEnd.getTime()
    );
    return {
      date: day,
      inventory: countInStockAt(items, dayEnd),
      added: items.filter(
        (i) =>
          i.createdAt.getTime() >= dayStart.getTime() &&
          i.createdAt.getTime() <= dayEnd.getTime()
      ).length,
      sold: soldItems.length,
      soldRevenue: soldItems.reduce((sum, i) => sum + (i.soldPrice ?? 0), 0),
    };
  });
}

export function parseStatsRange(
  fromStr: string,
  toStr?: string | null
): {
  rangeStart: Date;
  rangeEnd: Date;
  fromLabel: string;
  toLabel: string;
} | null {
  const rangeStart = parseDateParam(fromStr, false);
  if (!rangeStart) return null;

  let rangeEnd: Date;
  let toLabel: string;
  if (toStr && toStr.trim()) {
    const end = parseDateParam(toStr, true);
    if (!end) return null;
    rangeEnd = end;
    toLabel = toStr;
  } else {
    rangeEnd = new Date();
    toLabel = formatDateInput(rangeEnd);
  }

  if (rangeStart.getTime() > rangeEnd.getTime()) return null;

  return { rangeStart, rangeEnd, fromLabel: fromStr, toLabel };
}
