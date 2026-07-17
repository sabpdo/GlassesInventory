"use client";

import { useState } from "react";
import { startOfMonth, todayUtc } from "@/lib/csv";

export function SalesExportPanel() {
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(todayUtc());
  const [error, setError] = useState<string | null>(null);

  function download() {
    setError(null);
    if (from > to) {
      setError("Start date must be on or before end date.");
      return;
    }
    window.location.href = `/api/sales/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  }

  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold text-slate-900">
        Export sales (CSV)
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Download sold items for bookkeeping — frame details, barcode, price, and
        who marked it sold.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="sales-from" className="label">
            From
          </label>
          <input
            id="sales-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="input mt-1"
          />
        </div>
        <div>
          <label htmlFor="sales-to" className="label">
            To
          </label>
          <input
            id="sales-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input mt-1"
          />
        </div>
        <button type="button" onClick={download} className="btn-primary">
          Download CSV
        </button>
      </div>
      {error ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
