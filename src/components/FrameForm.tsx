"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Combobox } from "@/components/Combobox";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Modal } from "@/components/Modal";
import { ScanModal } from "@/components/ScanModal";
import { COLOR_SUGGESTIONS } from "@/lib/colors";
import { normalizeLabel } from "@/lib/normalize-label";
import { useToast } from "@/components/Toast";

export type FrameFormValues = {
  manufacturer: string;
  style: string;
  color: string;
  description: string;
  cost: string;
  retailCost: string;
  size: string;
  notes: string;
  quantity: string;
  barcode: string;
  markSold: boolean;
  soldPrice: string;
};

const empty: FrameFormValues = {
  manufacturer: "",
  style: "",
  color: "",
  description: "",
  cost: "",
  retailCost: "",
  size: "",
  notes: "",
  quantity: "1",
  barcode: "",
  markSold: false,
  soldPrice: "",
};

export function FrameForm({
  initial,
  frameId,
  submitLabel = "Save",
  onSaved,
  onCancel,
  /** When set (e.g. from Scan page), barcode is fixed and shown read-only. */
  lockedBarcode,
  /** Nested inside another card (e.g. Scan results) — no outer card styling. */
  embedded = false,
  cancelLabel = "Cancel",
}: {
  initial?: Partial<FrameFormValues>;
  frameId?: string;
  submitLabel?: string;
  onSaved?: (frameId: string) => void;
  onCancel?: () => void;
  lockedBarcode?: string;
  embedded?: boolean;
  cancelLabel?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const isCreate = !frameId;
  const [values, setValues] = useState<FrameFormValues>({
    ...empty,
    ...initial,
    quantity: initial?.quantity ?? (frameId ? "" : lockedBarcode ? "1" : "1"),
    barcode: lockedBarcode ?? initial?.barcode ?? "",
    markSold: initial?.markSold ?? false,
    soldPrice: initial?.soldPrice ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lossWarningOpen, setLossWarningOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateFrame, setDuplicateFrame] = useState<{
    id: string;
    manufacturer: string;
    style: string;
    color: string;
    description: string | null;
    inStock: number;
  } | null>(null);
  const [manufacturerSuggestions, setManufacturerSuggestions] = useState<
    string[]
  >([]);
  const [colorSuggestions, setColorSuggestions] = useState<string[]>([
    ...COLOR_SUGGESTIONS,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/manufacturer-suggestions", {
        signal: controller.signal,
        cache: "no-store",
      }),
      fetch("/api/color-suggestions", {
        signal: controller.signal,
        cache: "no-store",
      }),
    ])
      .then(async ([mRes, cRes]) => {
        if (mRes.ok) setManufacturerSuggestions(await mRes.json());
        if (cRes.ok) setColorSuggestions(await cRes.json());
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  function update<K extends keyof FrameFormValues>(
    key: K,
    v: FrameFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function normalizeManufacturer() {
    const next = normalizeLabel(values.manufacturer, manufacturerSuggestions);
    if (next !== values.manufacturer) update("manufacturer", next);
  }

  function normalizeColor() {
    const next = normalizeLabel(values.color, colorSuggestions);
    if (next !== values.color) update("color", next);
  }

  async function saveFrame(options?: {
    confirmDuplicate?: boolean;
    addToExistingFrameId?: string;
  }) {
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      manufacturer: normalizeLabel(
        values.manufacturer,
        manufacturerSuggestions
      ),
      style: values.style.trim(),
      color: normalizeLabel(values.color, colorSuggestions),
      description: values.description.trim() || null,
      cost: Number(values.cost || 0),
      retailCost: Number(values.retailCost || 0),
      size: values.size.trim() || null,
      notes: values.notes.trim() || null,
    };

    if (isCreate) {
      const barcode = (lockedBarcode ?? values.barcode).trim();
      const qtyRaw = values.quantity.trim();
      const quantity = qtyRaw === "" ? 0 : Number(qtyRaw);
      payload.barcode = barcode || null;
      payload.quantity = barcode ? 0 : quantity;
      payload.markSold = values.markSold;
      if (values.markSold && values.soldPrice.trim()) {
        payload.soldPrice = Number(values.soldPrice);
      }
      if (options?.confirmDuplicate) payload.confirmDuplicate = true;
      if (options?.addToExistingFrameId) {
        payload.addToExistingFrameId = options.addToExistingFrameId;
      }
    }

    const url = frameId ? `/api/frames/${frameId}` : "/api/frames";
    const method = frameId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (
        isCreate &&
        res.status === 409 &&
        data.duplicate &&
        data.existingFrame
      ) {
        setDuplicateFrame(data.existingFrame);
        setDuplicateOpen(true);
        return;
      }
      const msg = data.error ?? "Could not save frame.";
      setError(msg);
      toast.error(msg);
      return;
    }
    const saved = await res.json();
    const restocked = Boolean(options?.addToExistingFrameId);
    toast.success(
      frameId
        ? "Frame updated"
        : restocked
          ? "Added to existing frame"
          : "Frame created"
    );
    if (onSaved) onSaved(saved.id);
    else {
      router.push(`/frames/${saved.id}`);
      router.refresh();
    }
  }

  function plannedAddSummary(): string {
    const barcode = (lockedBarcode ?? values.barcode).trim();
    if (barcode) return "1 item with this barcode";
    const qtyRaw = values.quantity.trim();
    const quantity = qtyRaw === "" ? 0 : Number(qtyRaw);
    const count = quantity > 0 ? quantity : values.markSold ? 1 : 1;
    return `${count} item${count === 1 ? "" : "s"}`;
  }

  async function addToExistingInventory() {
    if (!duplicateFrame) return;
    setDuplicateOpen(false);
    setError(null);
    await saveFrame({ addToExistingFrameId: duplicateFrame.id });
  }

  async function createDuplicateAnyway() {
    setDuplicateOpen(false);
    setError(null);
    await saveFrame({ confirmDuplicate: true });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cost = Number(values.cost || 0);
    const retail = Number(values.retailCost || 0);
    if (!Number.isFinite(cost) || cost < 0) {
      setError("Cost must be a positive number.");
      return;
    }
    if (!Number.isFinite(retail) || retail < 0) {
      setError("Retail cost must be a positive number.");
      return;
    }

    if (isCreate) {
      const barcode = (lockedBarcode ?? values.barcode).trim();
      const qtyRaw = values.quantity.trim();
      if (!barcode && qtyRaw !== "") {
        const quantity = Number(qtyRaw);
        if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100) {
          setError("Quantity must be a whole number from 0 to 100.");
          return;
        }
      }
    }

    if (retail > 0 && cost > retail) {
      setLossWarningOpen(true);
      return;
    }

    await saveFrame();
  }

  const hasInventory =
    isCreate &&
    (lockedBarcode ||
      values.barcode.trim() !== "" ||
      (values.quantity.trim() !== "" && Number(values.quantity) > 0) ||
      values.markSold);

  return (
    <>
      <form
        onSubmit={onSubmit}
        className={embedded ? "space-y-5" : "card space-y-5 p-6"}
      >
        {lockedBarcode && !embedded ? (
          <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              Scanned barcode
            </div>
            <div className="mt-1 font-mono text-sm text-slate-900">
              {lockedBarcode}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="manufacturer" className="label">
              Manufacturer (Vendor)
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <div className="mt-1">
              <Combobox
                id="manufacturer"
                value={values.manufacturer}
                onChange={(v) => update("manufacturer", v)}
                options={manufacturerSuggestions}
                placeholder="Start typing a brand…"
                required
                onBlur={normalizeManufacturer}
              />
            </div>
          </div>
          <Field
            id="style"
            label="Style"
            required
            value={values.style}
            onChange={(v) => update("style", v)}
          />
          <div>
            <label htmlFor="color" className="label">
              Color
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <div className="mt-1">
              <Combobox
                id="color"
                value={values.color}
                onChange={(v) => update("color", v)}
                options={colorSuggestions}
                placeholder="Black, Tortoise, Silver…"
                required
                onBlur={normalizeColor}
              />
            </div>
          </div>
          <Field
            id="description"
            label="Description (optional)"
            placeholder="Model / style number"
            value={values.description}
            onChange={(v) => update("description", v)}
          />
          <div>
            <label htmlFor="cost" className="label">
              Cost
            </label>
            <div className="mt-1">
              <CurrencyInput
                id="cost"
                value={values.cost}
                onChange={(v) => update("cost", v)}
              />
            </div>
          </div>
          <div>
            <label htmlFor="retailCost" className="label">
              Retail Cost
            </label>
            <div className="mt-1">
              <CurrencyInput
                id="retailCost"
                value={values.retailCost}
                onChange={(v) => update("retailCost", v)}
              />
            </div>
          </div>
          <Field
            id="size"
            label="Size (optional)"
            placeholder="e.g. 52-19-140"
            value={values.size}
            onChange={(v) => update("size", v)}
          />
        </div>

        {isCreate ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              {lockedBarcode ? "This item" : "Initial inventory (optional)"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {lockedBarcode
                ? "Fill in the frame details below. Check “Mark as sold” if this pair is leaving the shop now."
                : "Most frames only need quantity 1. Leave blank to add items later."}
            </p>
            {!lockedBarcode ? (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  id="quantity"
                  label="Quantity"
                  type="number"
                  inputMode="numeric"
                  placeholder="1"
                  value={values.barcode.trim() ? "" : values.quantity}
                  onChange={(v) => update("quantity", v)}
                  hint={
                    values.barcode.trim()
                      ? "Ignored when a barcode is set."
                      : "How many pairs to add (no barcode)."
                  }
                  disabled={values.barcode.trim() !== ""}
                />
                <div>
                  <label htmlFor="barcode" className="label">
                    Barcode (optional)
                  </label>
                  <div className="mt-1 flex rounded-md ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-brand-500">
                    <input
                      id="barcode"
                      type="text"
                      placeholder="Type a barcode…"
                      value={values.barcode}
                      onChange={(e) => update("barcode", e.target.value)}
                      className="input flex-1 rounded-r-none border-0 shadow-none ring-0 focus:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => setScanOpen(true)}
                      title="Scan barcode"
                      className="border-l border-slate-300 px-3 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    >
                      📷
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Scan or type one barcode — adds exactly one item.
                  </p>
                </div>
              </div>
            ) : null}
            <label className="mt-4 flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={values.markSold}
                onChange={(e) => update("markSold", e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-slate-700">
                <span className="font-medium">Mark first item as sold</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {hasInventory
                    ? "The first item created will be marked sold."
                    : "Creates one item and marks it sold."}
                </span>
              </span>
            </label>
            {values.markSold ? (
              <div className="mt-3 max-w-xs">
                <label htmlFor="soldPrice" className="label">
                  Sold price (optional)
                </label>
                <div className="mt-1">
                  <CurrencyInput
                    id="soldPrice"
                    value={values.soldPrice}
                    onChange={(v) => update("soldPrice", v)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <label htmlFor="notes" className="label">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            rows={3}
            value={values.notes}
            onChange={(e) => update("notes", e.target.value)}
            className="input mt-1"
          />
        </div>

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => (onCancel ? onCancel() : router.back())}
            className="btn-secondary"
          >
            {cancelLabel}
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>

      <Modal
        open={duplicateOpen}
        onClose={() => !submitting && setDuplicateOpen(false)}
        busy={submitting}
        size="sm"
        title="Frame already exists"
        description="This matches a frame already in the system."
        footer={
          <>
            <button
              type="button"
              onClick={() => setDuplicateOpen(false)}
              disabled={submitting}
              className="btn-secondary"
            >
              Go back
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void createDuplicateAnyway()}
              className="btn-secondary"
            >
              Create anyway
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void addToExistingInventory()}
              className="btn-primary"
            >
              {submitting ? "Adding…" : "Add to inventory"}
            </button>
          </>
        }
      >
        {duplicateFrame ? (
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">
                {duplicateFrame.manufacturer} · {duplicateFrame.style} ·{" "}
                {duplicateFrame.color}
              </span>
              {duplicateFrame.description
                ? ` · ${duplicateFrame.description}`
                : null}
            </p>
            <p>
              Currently{" "}
              <span className="font-medium text-slate-900">
                {duplicateFrame.inStock} in stock
              </span>
              . Add {plannedAddSummary()} to this frame instead of creating a
              duplicate?
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={lossWarningOpen}
        onClose={() => !submitting && setLossWarningOpen(false)}
        busy={submitting}
        size="sm"
        title="Retail is below cost"
        description="You're saving a frame where retail price is less than cost."
        footer={
          <>
            <button
              type="button"
              onClick={() => setLossWarningOpen(false)}
              disabled={submitting}
              className="btn-secondary"
            >
              Go back
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setLossWarningOpen(false);
                void saveFrame();
              }}
              className="btn-primary"
            >
              {submitting ? "Saving…" : "Save anyway"}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          That&apos;s okay for clearance or damaged stock — just confirming
          before we save.
        </p>
      </Modal>

      <ScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScanned={(b) => {
          update("barcode", b);
          setScanOpen(false);
        }}
        title="Scan barcode"
        description="Use this device's camera or pair your phone with the QR code."
      />
    </>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
  inputMode,
  step,
  placeholder,
  list,
  hint,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  step?: string;
  placeholder?: string;
  list?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        step={step}
        placeholder={placeholder}
        list={list}
        disabled={disabled}
        autoComplete={list ? "off" : undefined}
        className="input mt-1 disabled:bg-slate-100 disabled:text-slate-400"
      />
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}
