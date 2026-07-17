"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FrameForm } from "@/components/FrameForm";
import { PairingPanel } from "@/components/PairingPanel";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";

type FrameLite = {
  id: string;
  manufacturer: string;
  style: string;
  color: string;
  description: string;
  cost: number;
  retailCost: number;
  size: string | null;
  inStock: number;
};

type ItemLookup = {
  found: boolean;
  barcode: string;
  item?: {
    id: string;
    barcode: string;
    status: string;
    soldAt: string | null;
    soldPrice: number | null;
    createdAt: string;
    frame: FrameLite;
  };
};

type Mode = "local" | "pair";

export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <ScanPageInner />
    </Suspense>
  );
}

function ScanPageInner() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "local" ? "local" : "pair";

  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(initialMode);

  const [barcode, setBarcode] = useState("");
  const [lookup, setLookup] = useState<ItemLookup | null>(null);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannerOn, setScannerOn] = useState(true);
  const [busy, setBusy] = useState(false);

  const [frames, setFrames] = useState<FrameLite[]>([]);
  const [framesLoaded, setFramesLoaded] = useState(false);
  const [selectedFrameId, setSelectedFrameId] = useState("");
  const [soldPrice, setSoldPrice] = useState("");

  const runLookup = useCallback(
    async (code: string) => {
      setLooking(true);
      setError(null);
      setLookup(null);
      try {
        const res = await fetch(
          `/api/items/by-barcode/${encodeURIComponent(code)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("Lookup failed");
        const data: ItemLookup = await res.json();
        setLookup(data);
        setSoldPrice("");
        if (!data.found && !framesLoaded) loadFrames();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLooking(false);
      }
    },
    [framesLoaded]
  );

  const handleScanned = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setBarcode(trimmed);
      setScannerOn(false);
      await runLookup(trimmed);
    },
    [runLookup]
  );

  // The phone delivers a barcode via the pairing endpoint → treat it the same
  // as a local scan.
  const handlePairScan = useCallback(
    (incoming: string) => {
      setBarcode(incoming);
      toast.success(`Phone scan: ${incoming}`);
      runLookup(incoming);
    },
    [runLookup, toast]
  );

  async function loadFrames() {
    const res = await fetch("/api/frames?sort=manufacturer&dir=asc", {
      cache: "no-store",
    });
    if (res.ok) {
      const data: FrameLite[] = await res.json();
      setFrames(data);
      setFramesLoaded(true);
    }
  }

  useEffect(() => {
    loadFrames();
  }, []);

  async function onManualLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!barcode.trim()) return;
    setScannerOn(false);
    await runLookup(barcode.trim());
  }

  async function markSold() {
    if (!lookup?.item) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/items/${lookup.item.id}/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        soldPrice: soldPrice.trim() ? Number(soldPrice) : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = data.error ?? "Could not mark as sold.";
      setError(msg);
      toast.error(msg);
      return;
    }
    const frame = lookup.item.frame;
    const priceLabel = soldPrice.trim()
      ? ` for ${formatCurrency(Number(soldPrice))}`
      : "";
    toast.success(`Sold ${frame.manufacturer} ${frame.style}${priceLabel}`);
    reset();
    router.refresh();
  }

  async function attachToFrame(e: React.FormEvent) {
    e.preventDefault();
    if (!lookup || lookup.found) return;
    if (!selectedFrameId) {
      setError("Pick a frame first.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barcode: lookup.barcode,
        frameId: selectedFrameId,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = data.error ?? "Could not attach barcode.";
      setError(msg);
      toast.error(msg);
      return;
    }
    toast.success(`Barcode attached`);
    reset();
    router.refresh();
  }

  function onFrameCreatedFromScan() {
    reset();
    router.refresh();
    loadFrames();
  }

  function reset() {
    setBarcode("");
    setLookup(null);
    setError(null);
    setSelectedFrameId("");
    setSoldPrice("");
    if (mode === "local") setScannerOn(true);
  }

  function switchMode(next: Mode) {
    setMode(next);
    reset();
    setScannerOn(next === "local");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← Back to inventory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Scan barcode
        </h1>
        <p className="text-sm text-slate-500">
          Scan to check out an item already in inventory, or to add a new
          barcode. Pair your phone to scan while you work on this computer — or
          use this device&apos;s camera.
        </p>
      </div>

      <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => switchMode("pair")}
          className={
            "rounded-md px-4 py-1.5 font-medium transition " +
            (mode === "pair"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700")
          }
        >
          Pair phone
        </button>
        <button
          type="button"
          onClick={() => switchMode("local")}
          className={
            "rounded-md px-4 py-1.5 font-medium transition " +
            (mode === "local"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700")
          }
        >
          This device
        </button>
      </div>

      {mode === "local" ? (
        <div className="card p-4">
          <BarcodeScanner onResult={handleScanned} paused={!scannerOn} />
          <form
            onSubmit={onManualLookup}
            className="mt-4 flex flex-wrap items-center gap-2"
          >
            <input
              type="text"
              placeholder="Or type a barcode…"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="input flex-1 min-w-[200px]"
            />
            <button type="submit" disabled={looking} className="btn-primary">
              {looking ? "Looking up…" : "Look up"}
            </button>
            <button type="button" onClick={reset} className="btn-secondary">
              Reset
            </button>
            <button
              type="button"
              onClick={() => setScannerOn((v) => !v)}
              className="btn-secondary"
            >
              {scannerOn ? "Pause camera" : "Start camera"}
            </button>
          </form>
          {error ? (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="card p-4">
          <PairingPanel enabled={mode === "pair"} onBarcode={handlePairScan} />
          {looking ? (
            <div className="mt-3 text-sm text-slate-500">Looking up scan…</div>
          ) : null}
          {error ? (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      )}

      {lookup ? (
        <div className="card p-6">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Barcode
          </div>
          <div className="font-mono text-sm text-slate-700">
            {lookup.barcode}
          </div>

          {lookup.found && lookup.item ? (
            <KnownItem
              item={lookup.item}
              soldPrice={soldPrice}
              setSoldPrice={setSoldPrice}
              onSell={markSold}
              busy={busy}
            />
          ) : (
            <NewBarcode
              barcode={lookup.barcode}
              frames={frames}
              selectedFrameId={selectedFrameId}
              setSelectedFrameId={setSelectedFrameId}
              onAttach={attachToFrame}
              onFrameCreated={onFrameCreatedFromScan}
              busy={busy}
            />
          )}

          <div className="mt-4 text-right">
            <button type="button" onClick={reset} className="btn-secondary">
              Ready for next scan
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function KnownItem({
  item,
  soldPrice,
  setSoldPrice,
  onSell,
  busy,
}: {
  item: NonNullable<ItemLookup["item"]>;
  soldPrice: string;
  setSoldPrice: (v: string) => void;
  onSell: () => void;
  busy: boolean;
}) {
  const sold = item.status === "SOLD";
  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-900">
              {item.frame.manufacturer} · {item.frame.style}
            </div>
            <div className="text-sm text-slate-500">
              {item.frame.color} · {item.frame.description}
              {item.frame.size ? ` · ${item.frame.size}` : ""}
            </div>
          </div>
          <span
            className={
              "inline-flex rounded-full px-3 py-1 text-sm font-semibold " +
              (sold
                ? "bg-slate-200 text-slate-700"
                : "bg-emerald-100 text-emerald-700")
            }
          >
            {sold ? "Sold" : "In stock"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Info label="Cost" value={formatCurrency(item.frame.cost)} />
          <Info label="Retail" value={formatCurrency(item.frame.retailCost)} />
          <Info label="In stock" value={String(item.frame.inStock)} />
          <Info label="Added" value={formatDate(item.createdAt)} />
        </div>
      </div>

      {sold ? (
        <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="font-semibold">Already sold</div>
          <div className="mt-1">
            Sold on {formatDate(item.soldAt)} for{" "}
            {formatCurrency(item.soldPrice)}.
          </div>
        </div>
      ) : (
        <div className="rounded-md bg-brand-50 px-4 py-4 ring-1 ring-brand-100">
          <div className="text-base font-semibold text-brand-700">
            Check out — mark as sold
          </div>
          <p className="mt-1 text-sm text-slate-600">
            This barcode is already in inventory. Mark sold when a customer buys
            it.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="soldPrice" className="label">
                Sold price (optional)
              </label>
              <div className="mt-1 w-40">
                <CurrencyInput
                  id="soldPrice"
                  value={soldPrice}
                  onChange={setSoldPrice}
                  placeholder="0.00"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onSell}
              disabled={busy}
              className="btn-primary"
            >
              {busy ? "Marking…" : "Mark as sold"}
            </button>
            <Link href={`/frames/${item.frame.id}`} className="btn-secondary">
              Open frame
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function NewBarcode({
  barcode,
  frames,
  selectedFrameId,
  setSelectedFrameId,
  onAttach,
  onFrameCreated,
  busy,
}: {
  barcode: string;
  frames: FrameLite[];
  selectedFrameId: string;
  setSelectedFrameId: (v: string) => void;
  onAttach: (e: React.FormEvent) => void;
  onFrameCreated: () => void;
  busy: boolean;
}) {
  const [mode, setMode] = useState<"attach" | "create">("create");

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-md bg-brand-50 px-4 py-3 ring-1 ring-brand-100">
        <div className="text-base font-semibold text-brand-700">
          New barcode — add to inventory
        </div>
        <p className="mt-1 text-sm text-slate-600">
          This barcode isn&apos;t in the system yet. Create a new frame below
          (use “Mark as sold” if it&apos;s leaving the shop now), or attach it
          to an existing frame.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="What do you want to do with this barcode?"
        className="inline-flex rounded-lg bg-slate-100 p-1 text-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "attach"}
          onClick={() => setMode("attach")}
          disabled={frames.length === 0}
          title={
            frames.length === 0
              ? "No frames exist yet — create one below"
              : undefined
          }
          className={
            "rounded-md px-4 py-1.5 font-medium transition " +
            (mode === "attach"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50")
          }
        >
          Attach to existing frame
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "create"}
          onClick={() => setMode("create")}
          className={
            "rounded-md px-4 py-1.5 font-medium transition " +
            (mode === "create"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700")
          }
        >
          Create new frame
        </button>
      </div>

      {mode === "attach" ? (
        <form onSubmit={onAttach} className="space-y-4">
          <div>
            <label htmlFor="frame" className="label">
              Attach to frame
            </label>
            <select
              id="frame"
              value={selectedFrameId}
              onChange={(e) => setSelectedFrameId(e.target.value)}
              className="input mt-1"
            >
              <option value="">Pick a frame…</option>
              {frames.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.manufacturer} — {f.style} — {f.color} ({f.description})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? "Attaching…" : "Attach barcode"}
            </button>
          </div>
        </form>
      ) : (
        <FrameForm
          lockedBarcode={barcode}
          submitLabel="Save frame"
          onSaved={() => onFrameCreated()}
        />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 font-medium text-slate-900">{value}</div>
    </div>
  );
}
