"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Combobox } from "@/components/Combobox";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Modal } from "@/components/Modal";
import { COLOR_SUGGESTIONS } from "@/lib/colors";
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
}: {
  initial?: Partial<FrameFormValues>;
  frameId?: string;
  submitLabel?: string;
  onSaved?: (frameId: string) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const isCreate = !frameId;
  const [values, setValues] = useState<FrameFormValues>({
    ...empty,
    ...initial,
    quantity: initial?.quantity ?? (frameId ? "" : "1"),
    barcode: initial?.barcode ?? "",
    markSold: initial?.markSold ?? false,
    soldPrice: initial?.soldPrice ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lossWarningOpen, setLossWarningOpen] = useState(false);
  const [manufacturerSuggestions, setManufacturerSuggestions] = useState<
    string[]
  >([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/manufacturer-suggestions", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: string[]) => setManufacturerSuggestions(data))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  function update<K extends keyof FrameFormValues>(
    key: K,
    v: FrameFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function saveFrame() {
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      manufacturer: values.manufacturer.trim(),
      style: values.style.trim(),
      color: values.color.trim(),
      description: values.description.trim() || null,
      cost: Number(values.cost || 0),
      retailCost: Number(values.retailCost || 0),
      size: values.size.trim() || null,
      notes: values.notes.trim() || null,
    };

    if (isCreate) {
      const barcode = values.barcode.trim();
      const qtyRaw = values.quantity.trim();
      const quantity = qtyRaw === "" ? 0 : Number(qtyRaw);
      payload.barcode = barcode || null;
      payload.quantity = barcode ? 0 : quantity;
      payload.markSold = values.markSold;
      if (values.markSold && values.soldPrice.trim()) {
        payload.soldPrice = Number(values.soldPrice);
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
      const msg = data.error ?? "Could not save frame.";
      setError(msg);
      toast.error(msg);
      return;
    }
    const saved = await res.json();
    toast.success(frameId ? "Frame updated" : "Frame created");
    if (onSaved) onSaved(saved.id);
    else {
      router.push(`/frames/${saved.id}`);
      router.refresh();
    }
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
      const barcode = values.barcode.trim();
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
    (values.barcode.trim() !== "" ||
      (values.quantity.trim() !== "" && Number(values.quantity) > 0) ||
      values.markSold);

  return (
    <>
      <form onSubmit={onSubmit} className="card space-y-5 p-6">
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
                options={COLOR_SUGGESTIONS}
                placeholder="Black, Tortoise, Silver…"
                required
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
              Initial inventory (optional)
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Most frames only need quantity 1. Leave both blank to add items
              later from the frame page or Scan.
            </p>
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
              <Field
                id="barcode"
                label="Barcode (optional)"
                placeholder="Scan or type one barcode"
                value={values.barcode}
                onChange={(v) => update("barcode", v)}
                hint="Adds exactly one item with this barcode."
              />
            </div>
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
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>

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
