"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Combobox } from "@/components/Combobox";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Modal } from "@/components/Modal";
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
  // When provided, replaces the default "router.back()" Cancel behavior.
  // Useful when the form is embedded inside another page (e.g. scan flow).
  onCancel?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<FrameFormValues>({ ...empty, ...initial });
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
      .catch(() => {
        // non-fatal — autocomplete just won't have suggestions
      });
    return () => controller.abort();
  }, []);

  function update<K extends keyof FrameFormValues>(key: K, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function saveFrame() {
    setSubmitting(true);

    const payload = {
      manufacturer: values.manufacturer.trim(),
      style: values.style.trim(),
      color: values.color.trim(),
      description: values.description.trim(),
      cost: Number(values.cost || 0),
      retailCost: Number(values.retailCost || 0),
      size: values.size.trim() || null,
      notes: values.notes.trim() || null,
    };

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

    // Client-side safety net (server still validates with zod).
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
    if (retail > 0 && cost > retail) {
      setLossWarningOpen(true);
      return;
    }

    await saveFrame();
  }

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
          <p className="mt-1 text-xs text-slate-400">
            Suggests common brands and any vendor you&apos;ve used before. You
            can also type a new name.
          </p>
        </div>
        <Field
          id="style"
          label="Style"
          required
          value={values.style}
          onChange={(v) => update("style", v)}
        />
        <Field
          id="color"
          label="Color"
          required
          value={values.color}
          onChange={(v) => update("color", v)}
        />
        <Field
          id="description"
          label="Description (Model / Style Number)"
          required
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
        autoComplete={list ? "off" : undefined}
        className="input mt-1"
      />
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}
