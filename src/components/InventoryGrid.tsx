"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MultiSelect } from "@/components/MultiSelect";
import { formatCurrency, formatDate, formatDescription } from "@/lib/utils";

const LOW_STOCK_THRESHOLD = 3;

type FrameRow = {
  id: string;
  manufacturer: string;
  style: string;
  color: string;
  description: string | null;
  cost: number;
  retailCost: number;
  size: string | null;
  inStock: number;
  createdAt: string;
};

type SortField = "manufacturer" | "description" | "cost" | "createdAt";
type SortDir = "asc" | "desc";

export function InventoryGrid() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initial state seeded from the URL so refresh/bookmark/share works.
  const [sort, setSort] = useState<SortField>(() => {
    const param = searchParams.get("sort");
    if (
      param === "description" ||
      param === "cost" ||
      param === "createdAt" ||
      param === "manufacturer"
    ) {
      return param;
    }
    return "manufacturer";
  });
  const [dir, setDir] = useState<SortDir>(
    (searchParams.get("dir") as SortDir) || "asc"
  );
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [selectedManufacturers, setSelectedManufacturers] = useState<string[]>(
    searchParams.get("manufacturer")?.split(",").filter(Boolean) ?? []
  );
  const [descPrefix, setDescPrefix] = useState(searchParams.get("desc") || "");
  const [showOutOfStock, setShowOutOfStock] = useState(
    searchParams.get("out") === "1"
  );

  const [rows, setRows] = useState<FrameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const filterActive =
    q.trim() !== "" ||
    selectedManufacturers.length > 0 ||
    descPrefix.trim() !== "";

  // Build the query string used both for the API call and for the address bar.
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (selectedManufacturers.length)
      params.set("manufacturer", selectedManufacturers.join(","));
    if (descPrefix.trim()) params.set("desc", descPrefix.trim());
    if (sort !== "manufacturer") params.set("sort", sort);
    if (dir !== "asc") params.set("dir", dir);
    if (showOutOfStock) params.set("out", "1");
    return params.toString();
  }, [q, selectedManufacturers, descPrefix, sort, dir, showOutOfStock]);

  // Mirror state into the URL bar (replace, so we don't blow up the back stack
  // on every keystroke).
  useEffect(() => {
    const url = queryString ? `/?${queryString}` : "/";
    router.replace(url, { scroll: false });
  }, [queryString, router]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | null = null;
    let cancelled = false;

    async function loadRows(silent: boolean) {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/frames?${queryString}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load inventory");
        const data: FrameRow[] = await res.json();
        if (cancelled) return;
        setRows(data);
        setLastUpdated(new Date());
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message);
      } finally {
        if (!silent && !cancelled) setLoading(false);
      }
    }

    async function loadManufacturers() {
      try {
        const res = await fetch("/api/frames/manufacturers", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: string[] = await res.json();
        if (cancelled) return;
        setManufacturers(data);
      } catch {
        // non-fatal
      }
    }

    loadRows(false);
    loadManufacturers();

    // Silent re-poll every 5s so phone-scanned changes show up without anyone
    // tapping refresh. Only while the tab is visible.
    function schedule() {
      if (cancelled) return;
      timer = window.setTimeout(async () => {
        if (document.visibilityState === "visible") {
          await loadRows(true);
          await loadManufacturers();
        }
        schedule();
      }, 5000);
    }
    schedule();

    function onVisibility() {
      if (document.visibilityState === "visible") {
        loadRows(true);
        loadManufacturers();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      controller.abort();
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [queryString]);

  const totals = useMemo(() => {
    const frames = rows.length;
    const units = rows.reduce((sum, r) => sum + r.inStock, 0);
    const lowStock = rows.filter(
      (r) => r.inStock > 0 && r.inStock < LOW_STOCK_THRESHOLD
    ).length;
    return { frames, units, lowStock };
  }, [rows]);

  // Press "/" to focus the search box (skip when already typing in a field).
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function toggleSort(field: SortField) {
    if (sort === field) {
      setDir(dir === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setDir(field === "createdAt" ? "desc" : "asc");
    }
  }

  function clearFilters() {
    setQ("");
    setSelectedManufacturers([]);
    setDescPrefix("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500">
            {loading
              ? "Loading…"
              : `${totals.frames} frame${totals.frames === 1 ? "" : "s"} · ${totals.units} unit${totals.units === 1 ? "" : "s"} in stock`}
            {!loading && totals.lowStock > 0 ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                <span aria-hidden>⚠</span>
                {totals.lowStock} low
              </span>
            ) : null}
            {lastUpdated && !loading ? (
              <span className="ml-2 text-xs text-slate-400">
                · auto-refreshing · updated{" "}
                {lastUpdated.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/frames/new" className="btn-primary">
            New Frame
          </Link>
          <Link href="/scan" className="btn-secondary">
            Scan
          </Link>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-3">
        <input
          ref={searchRef}
          type="search"
          placeholder='Search…  (press "/")'
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input w-60"
          aria-label="Search inventory"
        />
        <MultiSelect
          options={manufacturers}
          selected={selectedManufacturers}
          onChange={setSelectedManufacturers}
          emptyLabel="All manufacturers"
          searchPlaceholder="Filter manufacturers…"
          ariaLabel="Filter by manufacturer"
          width="w-56"
        />
        <input
          type="text"
          placeholder="Description starts with…"
          value={descPrefix}
          onChange={(e) => setDescPrefix(e.target.value)}
          className="input w-56"
          aria-label="Filter by description prefix"
        />
        <div className="flex items-center gap-1 text-sm text-slate-500">
          <span className="text-xs uppercase tracking-wide">Sort</span>
          <button
            type="button"
            onClick={() => toggleSort("manufacturer")}
            className={
              "rounded-md px-2 py-1 text-sm font-medium " +
              (sort === "manufacturer"
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100")
            }
          >
            Vendor {sort === "manufacturer" ? (dir === "asc" ? "↑" : "↓") : ""}
          </button>
          <button
            type="button"
            onClick={() => toggleSort("description")}
            className={
              "rounded-md px-2 py-1 text-sm font-medium " +
              (sort === "description"
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100")
            }
          >
            Description{" "}
            {sort === "description" ? (dir === "asc" ? "↑" : "↓") : ""}
          </button>
          <button
            type="button"
            onClick={() => toggleSort("cost")}
            className={
              "rounded-md px-2 py-1 text-sm font-medium " +
              (sort === "cost"
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100")
            }
          >
            Cost {sort === "cost" ? (dir === "asc" ? "↑" : "↓") : ""}
          </button>
          <button
            type="button"
            onClick={() => toggleSort("createdAt")}
            className={
              "rounded-md px-2 py-1 text-sm font-medium " +
              (sort === "createdAt"
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100")
            }
          >
            Recent {sort === "createdAt" ? (dir === "asc" ? "↑" : "↓") : ""}
          </button>
        </div>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showOutOfStock}
            onChange={(e) => setShowOutOfStock(e.target.checked)}
            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Show out of stock
        </label>
        {filterActive ? (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="card overflow-hidden">
        <div className="max-h-[calc(100vh-280px)] overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-sm">
              <tr>
                <Th
                  active={sort === "manufacturer"}
                  dir={dir}
                  onClick={() => toggleSort("manufacturer")}
                >
                  Manufacturer
                </Th>
                <th className="px-4 py-3">Style</th>
                <th className="px-4 py-3">Color</th>
                <Th
                  active={sort === "description"}
                  dir={dir}
                  onClick={() => toggleSort("description")}
                >
                  Description
                </Th>
                <Th
                  active={sort === "cost"}
                  dir={dir}
                  onClick={() => toggleSort("cost")}
                  className="text-right"
                >
                  Cost
                </Th>
                <th className="px-4 py-3 text-right">Retail</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3 text-right">In Stock</th>
                <Th
                  active={sort === "createdAt"}
                  dir={dir}
                  onClick={() => toggleSort("createdAt")}
                >
                  Added
                </Th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-slate-400"
                  >
                    Loading inventory…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-slate-400"
                  >
                    {filterActive ? (
                      <>
                        No in-stock frames match these filters.{" "}
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="font-medium text-brand-700 hover:text-brand-600"
                        >
                          Clear filters
                        </button>
                        {!showOutOfStock ? (
                          <>
                            {" "}
                            or{" "}
                            <button
                              type="button"
                              onClick={() => setShowOutOfStock(true)}
                              className="font-medium text-brand-700 hover:text-brand-600"
                            >
                              show out of stock
                            </button>
                          </>
                        ) : null}
                        .
                      </>
                    ) : !showOutOfStock ? (
                      <>
                        No frames in stock.{" "}
                        <button
                          type="button"
                          onClick={() => setShowOutOfStock(true)}
                          className="font-medium text-brand-700 hover:text-brand-600"
                        >
                          Show out of stock
                        </button>{" "}
                        or{" "}
                        <Link
                          href="/frames/new"
                          className="font-medium text-brand-700 hover:text-brand-600"
                        >
                          add a frame
                        </Link>
                        .
                      </>
                    ) : (
                      <>
                        No frames yet.{" "}
                        <Link
                          href="/frames/new"
                          className="font-medium text-brand-700 hover:text-brand-600"
                        >
                          Add your first frame
                        </Link>
                        .
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const href = `/frames/${r.id}`;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => router.push(href)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(href);
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`Open ${r.manufacturer} ${r.style}`}
                      className="cursor-pointer hover:bg-slate-50 focus:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {r.manufacturer}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{r.style}</td>
                      <td className="px-4 py-3 text-slate-700">{r.color}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDescription(r.description)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700 tabular-nums">
                        {formatCurrency(r.cost)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700 tabular-nums">
                        {formatCurrency(r.retailCost)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {r.size ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                        <span
                          title={
                            r.inStock === 0
                              ? "Out of stock"
                              : r.inStock < LOW_STOCK_THRESHOLD
                                ? "Low stock — consider reordering"
                                : `${r.inStock} in stock`
                          }
                          className={
                            "inline-flex min-w-[2.5rem] justify-center rounded-full px-2 py-0.5 text-xs font-semibold " +
                            (r.inStock === 0
                              ? "bg-slate-100 text-slate-500"
                              : r.inStock < LOW_STOCK_THRESHOLD
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700")
                          }
                        >
                          {r.inStock}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <span
                          aria-hidden
                          className="text-sm font-medium text-brand-700"
                        >
                          Open →
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({
  active,
  dir,
  children,
  onClick,
  className = "",
}: {
  active: boolean;
  dir: SortDir;
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={"px-4 py-3 " + className}>
      <button
        type="button"
        onClick={onClick}
        className={
          "inline-flex w-full items-center gap-1 text-xs font-semibold uppercase tracking-wide " +
          (className.includes("text-right") ? "justify-end " : "") +
          (active ? "text-brand-700" : "text-slate-500 hover:text-slate-700")
        }
      >
        {children}
        <span className="text-[10px]">
          {active ? (dir === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
  );
}
