"use client";

import { useCallback, useEffect, useState } from "react";
import { TrendChart } from "@/components/TrendChart";
import { daysAgo } from "@/lib/inventory-stats";
import { startOfMonth } from "@/lib/csv";
import { formatCurrency, formatDate } from "@/lib/utils";

type StatsResponse = {
  current: {
    inStock: number;
    frameStyles: number;
    frameStylesInStock: number;
    pairsTracked: number;
    soldAllTime: number;
  };
  range: { from: string; to: string };
  period: {
    inventoryStart: number;
    inventoryEnd: number;
    added: number;
    sold: number;
    soldRevenue: number;
    netExpected: number;
    unaccounted: number;
    stockRemoved: number;
    itemsDeleted: number;
    framesDeleted: number;
    adjustedNetExpected: number;
    adjustedUnaccounted: number;
  };
  deletions: {
    id: string;
    kind: string;
    occurredAt: string;
    actorName: string | null;
    label: string;
    barcode: string | null;
    stockRemoved: number;
  }[];
  trend: {
    date: string;
    inventory: number;
    added: number;
    sold: number;
    soldRevenue: number;
  }[];
};

function Delta({
  value,
  label,
  invert,
}: {
  value: number;
  label?: string;
  invert?: boolean;
}) {
  if (value === 0) {
    return <span className="text-slate-500">no change</span>;
  }
  const negative = value < 0;
  const bad = invert ? !negative : negative;
  const sign = value > 0 ? "+" : "";
  return (
    <span className={bad ? "text-red-700" : "text-emerald-700"}>
      {sign}
      {value}
      {label ? ` ${label}` : ""}
    </span>
  );
}

export function StatsPanel() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState("");
  const [compareNow, setCompareNow] = useState(true);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from });
      if (!compareNow && to.trim()) params.set("to", to.trim());
      const res = await fetch(`/api/stats?${params}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not load stats.");
      setData(body as StatsResponse);
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, compareNow]);

  useEffect(() => {
    void load();
  }, [load]);

  const inventoryChange =
    data != null ? data.period.inventoryEnd - data.period.inventoryStart : null;

  return (
    <div className="space-y-6">
      {data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="In stock now" value={String(data.current.inStock)} />
          <StatCard
            label="Frame styles"
            value={String(data.current.frameStylesInStock)}
            sub={`${data.current.frameStyles} total styles`}
          />
          <StatCard
            label="Pairs tracked"
            value={String(data.current.pairsTracked)}
            sub={`${data.current.soldAllTime} sold all time`}
          />
          <StatCard
            label="Sold (period)"
            value={String(data.period.sold)}
            sub={formatCurrency(data.period.soldRevenue)}
          />
        </div>
      ) : null}

      <div className="card space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Compare dates
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Stats are computed live from item history — no snapshots or cron
            jobs. Compare now vs a date, or pick two dates.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="stats-from" className="label">
              From
            </label>
            <input
              id="stats-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="input mt-1"
            />
          </div>
          <div>
            <label htmlFor="stats-to" className="label">
              To
            </label>
            <input
              id="stats-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={compareNow}
              className="input mt-1 disabled:bg-slate-100"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={compareNow}
              onChange={(e) => setCompareNow(e.target.checked)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Through today (now)
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "Running…" : "Run stats"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <Preset
            label="Last 7 days"
            onClick={() => {
              setFrom(daysAgo(7));
              setCompareNow(true);
            }}
          />
          <Preset
            label="Last 30 days"
            onClick={() => {
              setFrom(daysAgo(30));
              setCompareNow(true);
            }}
          />
          <Preset
            label="Last 90 days"
            onClick={() => {
              setFrom(daysAgo(90));
              setCompareNow(true);
            }}
          />
          <Preset
            label="This month"
            onClick={() => {
              setFrom(startOfMonth());
              setCompareNow(true);
            }}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <p className="text-sm text-slate-500">Loading stats…</p>
      ) : null}

      {data ? (
        <>
          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Period summary ({data.range.from} → {data.range.to})
              </h2>
            </div>
            <dl className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
              <SummaryRow
                label="In stock at start"
                value={String(data.period.inventoryStart)}
              />
              <SummaryRow
                label="In stock at end"
                value={String(data.period.inventoryEnd)}
                extra={
                  inventoryChange != null ? (
                    <Delta value={inventoryChange} label="pairs" />
                  ) : null
                }
              />
              <SummaryRow
                label="Added to inventory"
                value={String(data.period.added)}
              />
              <SummaryRow
                label="Marked sold"
                value={String(data.period.sold)}
                extra={
                  <span className="text-slate-500">
                    {formatCurrency(data.period.soldRevenue)}
                  </span>
                }
              />
              <SummaryRow
                label="Manually removed"
                value={String(data.period.stockRemoved)}
                extra={
                  <span className="text-slate-500">
                    {data.period.itemsDeleted} item
                    {data.period.itemsDeleted === 1 ? "" : "s"},{" "}
                    {data.period.framesDeleted} frame style
                    {data.period.framesDeleted === 1 ? "" : "s"}
                  </span>
                }
              />
              <SummaryRow
                label="Expected end (start + added − sold − removed)"
                value={String(data.period.adjustedNetExpected)}
              />
              <SummaryRow
                label="Remaining unexplained"
                value={String(data.period.adjustedUnaccounted)}
                highlight={
                  data.period.adjustedUnaccounted !== 0 ? "warn" : undefined
                }
                hint="Should be near zero. Large values may mean mark-unsold or data entered before delete logging."
              />
            </dl>
          </div>

          {data.deletions.length > 0 ? (
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Manual deletions in this period
                </h2>
              </div>
              <ul className="divide-y divide-slate-100 text-sm">
                {data.deletions.map((d) => (
                  <li key={d.id} className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {d.kind === "FRAME_DELETED"
                        ? "Frame style deleted"
                        : "Item deleted"}
                      {" · "}
                      {d.label}
                    </div>
                    <div className="mt-0.5 text-slate-500">
                      {formatDate(d.occurredAt)}
                      {d.actorName ? ` · by ${d.actorName}` : ""}
                      {d.barcode ? ` · barcode ${d.barcode}` : ""}
                      {d.stockRemoved > 0
                        ? ` · ${d.stockRemoved} removed from stock`
                        : ""}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <TrendChart
            title="Inventory in stock over time"
            dates={data.trend.map((p) => p.date)}
            series={[
              {
                label: "In stock",
                values: data.trend.map((p) => p.inventory),
                color: "#059669",
              },
            ]}
          />

          <TrendChart
            title="Sold per day"
            dates={data.trend.map((p) => p.date)}
            series={[
              {
                label: "Sold",
                values: data.trend.map((p) => p.sold),
                color: "#2563eb",
              },
            ]}
          />

          <TrendChart
            title="Added to inventory per day"
            dates={data.trend.map((p) => p.date)}
            series={[
              {
                label: "Added",
                values: data.trend.map((p) => p.added),
                color: "#7c3aed",
              },
            ]}
          />
        </>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-xs text-slate-400">{sub}</div> : null}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  extra,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  extra?: React.ReactNode;
  hint?: string;
  highlight?: "warn";
}) {
  return (
    <div
      className={"px-4 py-4 " + (highlight === "warn" ? "bg-amber-50/80" : "")}
    >
      <dt className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
        {value}
      </dd>
      {extra ? <dd className="mt-1 text-sm">{extra}</dd> : null}
      {hint ? <dd className="mt-1 text-xs text-slate-500">{hint}</dd> : null}
    </div>
  );
}

function Preset({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200"
    >
      {label}
    </button>
  );
}
