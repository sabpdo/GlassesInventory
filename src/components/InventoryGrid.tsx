"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MultiSelect } from "@/components/MultiSelect";
import {
  defaultSortDir,
  type FrameSortField,
  isFrameSortField,
} from "@/lib/frame-sort";
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

type SortDir = "asc" | "desc";

function parseSort(param: string | null): FrameSortField {
  if (param && isFrameSortField(param)) return param;
  return "manufacturer";
}

export function InventoryGrid() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sort, setSort] = useState<FrameSortField>(() =>
    parseSort(searchParams.get("sort"))
  );
  const [dir, setDir] = useState<SortDir>(() => {
    const param = searchParams.get("dir");
    if (param === "asc" || param === "desc") return param;
    return defaultSortDir(parseSort(searchParams.get("sort")));
  });
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [selectedManufacturers, setSelectedManufacturers] = useState<string[]>(
    searchParams.get("manufacturer")?.split(",").filter(Boolean) ?? []
  );
  const [selectedColors, setSelectedColors] = useState<string[]>(
    searchParams.get("color")?.split(",").filter(Boolean) ?? []
  );
  const [descPrefix, setDescPrefix] = useState(searchParams.get("desc") || "");
  const [showOutOfStock, setShowOutOfStock] = useState(
    searchParams.get("out") === "1"
  );

  const [rows, setRows] = useState<FrameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const filterActive =
    q.trim() !== "" ||
    selectedManufacturers.length > 0 ||
    selectedColors.length > 0 ||
    descPrefix.trim() !== "";

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (selectedManufacturers.length)
      params.set("manufacturer", selectedManufacturers.join(","));
    if (selectedColors.length) params.set("color", selectedColors.join(","));
    if (descPrefix.trim()) params.set("desc", descPrefix.trim());
    if (sort !== "manufacturer") params.set("sort", sort);
    if (dir !== defaultSortDir(sort)) params.set("dir", dir);
    if (showOutOfStock) params.set("out", "1");
    return params.toString();
  }, [
    q,
    selectedManufacturers,
    selectedColors,
    descPrefix,
    sort,
    dir,
    showOutOfStock,
  ]);

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

    async function loadFilterOptions() {
      try {
        const [mRes, cRes] = await Promise.all([
          fetch("/api/frames/manufacturers", {
            signal: controller.signal,
            cache: "no-store",
          }),
          fetch("/api/color-suggestions", {
            signal: controller.signal,
            cache: "no-store",
          }),
        ]);
        if (mRes.ok) {
          const data: string[] = await mRes.json();
          if (!cancelled) setManufacturers(data);
        }
        if (cRes.ok) {
          const data: string[] = await cRes.json();
          if (!cancelled) setColors(data);
        }
      } catch {
        // non-fatal
      }
    }

    loadRows(false);
    loadFilterOptions();

    function schedule() {
      if (cancelled) return;
      timer = window.setTimeout(async () => {
        if (document.visibilityState === "visible") {
          await loadRows(true);
          await loadFilterOptions();
        }
        schedule();
      }, 5000);
    }
    schedule();

    function onVisibility() {
      if (document.visibilityState === "visible") {
        loadRows(true);
        loadFilterOptions();
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

  function toggleSort(field: FrameSortField) {
    if (sort === field) {
      setDir(dir === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setDir(defaultSortDir(field));
    }
  }

  function clearFilters() {
    setQ("");
    setSelectedManufacturers([]);
    setSelectedColors([]);
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
        <MultiSelect
          options={colors}
          selected={selectedColors}
          onChange={setSelectedColors}
          emptyLabel="All colors"
          searchPlaceholder="Filter colors…"
          ariaLabel="Filter by color"
          width="w-48"
        />
        <input
          type="text"
          placeholder="Description starts with…"
          value={descPrefix}
          onChange={(e) => setDescPrefix(e.target.value)}
          className="input w-56"
          aria-label="Filter by description prefix"
        />
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
                <Th
                  active={sort === "style"}
                  dir={dir}
                  onClick={() => toggleSort("style")}
                >
                  Style
                </Th>
                <Th
                  active={sort === "color"}
                  dir={dir}
                  onClick={() => toggleSort("color")}
                >
                  Color
                </Th>
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
                  align="right"
                >
                  Cost
                </Th>
                <Th
                  active={sort === "retailCost"}
                  dir={dir}
                  onClick={() => toggleSort("retailCost")}
                  align="right"
                >
                  Retail
                </Th>
                <Th
                  active={sort === "size"}
                  dir={dir}
                  onClick={() => toggleSort("size")}
                >
                  Size
                </Th>
                <Th
                  active={sort === "inStock"}
                  dir={dir}
                  onClick={() => toggleSort("inStock")}
                  align="right"
                >
                  In Stock
                </Th>
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
  align = "left",
}: {
  active: boolean;
  dir: SortDir;
  children: React.ReactNode;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th className={"px-4 py-3 " + (align === "right" ? "text-right" : "")}>
      <button
        type="button"
        onClick={onClick}
        className={
          "inline-flex w-full items-center gap-1 text-xs font-semibold uppercase tracking-wide " +
          (align === "right" ? "justify-end " : "") +
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
