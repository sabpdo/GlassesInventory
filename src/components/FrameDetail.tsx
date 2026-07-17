"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FrameForm, type FrameFormValues } from "@/components/FrameForm";
import { Modal } from "@/components/Modal";
import { ScanModal } from "@/components/ScanModal";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatDate, formatDescription } from "@/lib/utils";

type Item = {
  id: string;
  barcode: string | null;
  status: string;
  soldAt: string | null;
  soldPrice: number | null;
  createdAt: string;
  createdByName: string | null;
  soldByName: string | null;
};

type Frame = {
  id: string;
  manufacturer: string;
  style: string;
  color: string;
  description: string | null;
  cost: number;
  retailCost: number;
  size: string | null;
  notes: string | null;
  inStock: number;
  items: Item[];
};

export function FrameDetail({ frame }: { frame: Frame }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);

  // "Add without barcode" modal
  const [noBarcodeOpen, setNoBarcodeOpen] = useState(false);
  const [noBarcodeQty, setNoBarcodeQty] = useState("1");
  const [noBarcodeBusy, setNoBarcodeBusy] = useState(false);
  const [noBarcodeError, setNoBarcodeError] = useState<string | null>(null);

  // Mark-sold modal state
  const [sellItem, setSellItem] = useState<Item | null>(null);
  const [soldPrice, setSoldPrice] = useState("");
  const [selling, setSelling] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);

  // Delete-frame modal state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Set when the server tells us this frame has SOLD items; user has to
  // re-confirm with force=1 to permanently erase the sales history.
  const [forceDelete, setForceDelete] = useState<{ soldCount: number } | null>(
    null
  );

  const soldHistoryCount = frame.items.filter(
    (i) => i.status === "SOLD"
  ).length;

  const initial: Partial<FrameFormValues> = {
    manufacturer: frame.manufacturer,
    style: frame.style,
    color: frame.color,
    description: frame.description ?? "",
    cost: String(frame.cost),
    retailCost: String(frame.retailCost),
    size: frame.size ?? "",
    notes: frame.notes ?? "",
  };

  async function addItemByBarcode(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Enter or scan a barcode first.");
      return;
    }
    setError(null);
    setAdding(true);
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode: trimmed, frameId: frame.id }),
    });
    setAdding(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = data.error ?? "Could not add item.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setBarcode("");
    toast.success(`Item added — barcode ${trimmed}`);
    router.refresh();
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    await addItemByBarcode(barcode);
  }

  async function addWithoutBarcode(e: React.FormEvent) {
    e.preventDefault();
    setNoBarcodeError(null);
    const qty = Number(noBarcodeQty);
    if (!Number.isFinite(qty) || qty < 1 || qty > 100) {
      setNoBarcodeError("Quantity must be a whole number between 1 and 100.");
      return;
    }
    setNoBarcodeBusy(true);
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frameId: frame.id, quantity: qty }),
    });
    setNoBarcodeBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setNoBarcodeError(data.error ?? "Could not add items.");
      return;
    }
    setNoBarcodeOpen(false);
    setNoBarcodeQty("1");
    toast.success(`Added ${qty} item${qty === 1 ? "" : "s"} without barcode`);
    router.refresh();
  }

  function openSellDialog(item: Item) {
    setSellItem(item);
    setSoldPrice(frame.retailCost ? String(frame.retailCost) : "");
    setSellError(null);
  }

  function closeSellDialog() {
    if (selling) return;
    setSellItem(null);
    setSoldPrice("");
    setSellError(null);
  }

  async function confirmSell(e: React.FormEvent) {
    e.preventDefault();
    if (!sellItem) return;
    setSellError(null);
    setSelling(true);
    const res = await fetch(`/api/items/${sellItem.id}/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        soldPrice: soldPrice.trim() === "" ? undefined : Number(soldPrice),
      }),
    });
    setSelling(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSellError(data.error ?? "Could not mark as sold.");
      return;
    }
    const priceLabel =
      soldPrice.trim() === ""
        ? ""
        : ` for ${formatCurrency(Number(soldPrice))}`;
    toast.success(`Sold ${frame.manufacturer} ${frame.style}${priceLabel}`);
    setSellItem(null);
    setSoldPrice("");
    router.refresh();
  }

  async function confirmDelete(force = false) {
    setDeleteError(null);
    setDeleting(true);
    const url = force
      ? `/api/frames/${frame.id}?force=1`
      : `/api/frames/${frame.id}`;
    const res = await fetch(url, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // The API returns 409 + { soldCount } when there's sold history.
      // Switch the modal into "are you SURE?" mode rather than just showing
      // an error.
      if (res.status === 409 && typeof data.soldCount === "number" && !force) {
        setForceDelete({ soldCount: data.soldCount });
        return;
      }
      const msg = data.error ?? "Could not delete frame.";
      setDeleteError(msg);
      toast.error(msg);
      return;
    }
    toast.success("Frame deleted");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← Back to inventory
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {frame.manufacturer} · {frame.style}
            </h1>
            <p className="text-sm text-slate-500">
              {frame.color}
              {frame.description ? ` · ${frame.description}` : null}
              {frame.size ? ` · ${frame.size}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              {frame.inStock} in stock
            </span>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="btn-secondary"
            >
              {editing ? "Cancel edit" : "Edit"}
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="btn-danger"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {editing ? (
        <FrameForm
          frameId={frame.id}
          initial={initial}
          submitLabel="Save changes"
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Cost" value={formatCurrency(frame.cost)} />
          <Stat label="Retail" value={formatCurrency(frame.retailCost)} />
          <Stat label="Size" value={frame.size ?? "—"} />
          <Stat label="In stock" value={String(frame.inStock)} />
        </div>
      )}

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Items</h2>
            <p className="text-sm text-slate-500">
              Each item is a single physical pair tied to a unique barcode.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <form
              onSubmit={addItem}
              className="flex items-center rounded-md ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-brand-500"
            >
              <input
                type="text"
                placeholder="Type or scan barcode…"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-52 rounded-l-md border-0 bg-transparent px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                aria-label="Barcode"
                required
              />
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                title="Scan with camera"
                aria-label="Scan with camera"
                className="border-l border-slate-300 px-2.5 py-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              >
                <span aria-hidden>📷</span>
              </button>
              <button
                type="submit"
                disabled={adding || !barcode.trim()}
                className="rounded-r-md border-l border-slate-300 bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                {adding ? "Adding…" : "Add"}
              </button>
            </form>
            <span className="text-xs uppercase tracking-wide text-slate-400">
              or
            </span>
            <button
              type="button"
              onClick={() => {
                setNoBarcodeError(null);
                setNoBarcodeOpen(true);
              }}
              className="text-sm font-medium text-brand-700 hover:text-brand-600"
            >
              Add without barcode
            </button>
          </div>
        </div>
        {error ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Barcode</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3">Sold</th>
                <th className="px-4 py-3 text-right">Sold price</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {frame.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <div className="text-slate-400">No items yet.</div>
                    <div className="mt-1 text-xs text-slate-400">
                      Scan a barcode, type one above, or add without a barcode.
                    </div>
                  </td>
                </tr>
              ) : (
                frame.items.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      {it.barcode ?? (
                        <span className="font-sans italic text-slate-400">
                          no barcode
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold " +
                          (it.status === "SOLD"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-emerald-100 text-emerald-700")
                        }
                      >
                        {it.status === "SOLD" ? "Sold" : "In stock"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{formatDate(it.createdAt)}</div>
                      {it.createdByName ? (
                        <div className="text-xs text-slate-400">
                          by {it.createdByName}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {it.soldAt ? (
                        <>
                          <div>{formatDate(it.soldAt)}</div>
                          {it.soldByName ? (
                            <div className="text-xs text-slate-400">
                              by {it.soldByName}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {formatCurrency(it.soldPrice)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {it.status === "IN_STOCK" ? (
                        <button
                          type="button"
                          onClick={() => openSellDialog(it)}
                          className="text-sm font-medium text-brand-700 hover:text-brand-600"
                        >
                          Mark sold
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Scan a new item for this frame"
        description={`${frame.manufacturer} · ${frame.style}. The barcode is added as soon as it's detected.`}
        onScanned={(b) => addItemByBarcode(b)}
      />

      {/* Add-without-barcode modal */}
      <Modal
        open={noBarcodeOpen}
        onClose={() => !noBarcodeBusy && setNoBarcodeOpen(false)}
        busy={noBarcodeBusy}
        size="sm"
        title="Add items without a barcode"
        description="Useful for older frames or when the barcode is missing or damaged. Each item still counts toward inventory."
        footer={
          <>
            <button
              type="button"
              onClick={() => setNoBarcodeOpen(false)}
              disabled={noBarcodeBusy}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="no-barcode-form"
              disabled={noBarcodeBusy}
              className="btn-primary"
            >
              {noBarcodeBusy ? "Adding…" : "Add"}
            </button>
          </>
        }
      >
        <form id="no-barcode-form" onSubmit={addWithoutBarcode}>
          <label htmlFor="no-barcode-qty" className="label">
            Quantity
          </label>
          <input
            id="no-barcode-qty"
            type="number"
            inputMode="numeric"
            min="1"
            max="100"
            step="1"
            value={noBarcodeQty}
            onChange={(e) => setNoBarcodeQty(e.target.value)}
            className="input mt-1 w-32"
            autoFocus
          />
          <p className="mt-2 text-xs text-slate-400">
            Up to 100 at a time. You can mark them sold individually later from
            the items list below.
          </p>
          {noBarcodeError ? (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {noBarcodeError}
            </p>
          ) : null}
        </form>
      </Modal>

      {/* Mark-as-sold modal */}
      <Modal
        open={sellItem !== null}
        onClose={closeSellDialog}
        busy={selling}
        title="Mark item as sold"
        description={
          sellItem
            ? `${sellItem.barcode ? "Barcode " + sellItem.barcode : "Item without a barcode"} — ${frame.manufacturer} ${frame.style}`
            : undefined
        }
        footer={
          <>
            <button
              type="button"
              onClick={closeSellDialog}
              disabled={selling}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="sell-form"
              disabled={selling}
              className="btn-primary"
            >
              {selling ? "Marking…" : "Mark as sold"}
            </button>
          </>
        }
      >
        <form id="sell-form" onSubmit={confirmSell} className="space-y-3">
          <div>
            <label htmlFor="sold-price" className="label">
              Sold price
            </label>
            <div className="mt-1">
              <CurrencyInput
                id="sold-price"
                value={soldPrice}
                onChange={setSoldPrice}
                placeholder={String(frame.retailCost || "0.00")}
                autoFocus
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Leave blank to record the sale without a price.
            </p>
          </div>
          {sellError ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {sellError}
            </p>
          ) : null}
        </form>
      </Modal>

      {/* Delete-frame confirmation modal */}
      <Modal
        open={deleteOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteOpen(false);
            setDeleteError(null);
            setForceDelete(null);
          }
        }}
        busy={deleting}
        title={
          forceDelete
            ? "Wait — this frame has sales history"
            : "Delete this frame?"
        }
        description={`${frame.manufacturer} · ${frame.style}${frame.description ? ` (${frame.description})` : ""}`}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setDeleteOpen(false);
                setDeleteError(null);
                setForceDelete(null);
              }}
              disabled={deleting}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => confirmDelete(forceDelete !== null)}
              disabled={deleting}
              className="btn-danger"
            >
              {deleting
                ? "Deleting…"
                : forceDelete
                  ? `Yes, erase ${forceDelete.soldCount} sold item${
                      forceDelete.soldCount === 1 ? "" : "s"
                    }`
                  : "Delete frame"}
            </button>
          </>
        }
      >
        {forceDelete ? (
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              This frame has{" "}
              <span className="font-semibold text-red-700">
                {forceDelete.soldCount} sold item
                {forceDelete.soldCount === 1 ? "" : "s"}
              </span>{" "}
              attached. Deleting the frame will permanently erase that sales
              record — it won&apos;t show up on your profile or any reports
              afterward.
            </p>
            <p className="text-slate-500">
              If you&apos;re sure, confirm below. Otherwise cancel and consider
              just removing the in-stock items instead.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            This removes the frame and{" "}
            <span className="font-semibold">
              {frame.items.length} item{frame.items.length === 1 ? "" : "s"}
            </span>{" "}
            attached to it
            {soldHistoryCount > 0
              ? ` (including ${soldHistoryCount} sold)`
              : ""}
            . This can&apos;t be undone.
          </p>
        )}
        {deleteError ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {deleteError}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}
