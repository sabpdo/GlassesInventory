"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";

type PageProps = { params: { code: string } };

export default function PhonePairPage({ params }: PageProps) {
  const code = params.code.toUpperCase();

  const [valid, setValid] = useState<boolean | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [scannerOn, setScannerOn] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Validate the code once on mount (without leaking auth UI).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pair/${encodeURIComponent(code)}`, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setValid(false);
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Pair code is not valid.");
          return;
        }
        const data = await res.json();
        setValid(true);
        setExpiresAt(data.expiresAt);
      })
      .catch(() => {
        if (!cancelled) {
          setValid(false);
          setError("Could not reach the server.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Tiny debounce so a single barcode read doesn't fire repeatedly.
  const lastSentAtRef = useRef(0);
  const handleScanned = useCallback(
    async (barcode: string) => {
      const trimmed = barcode.trim();
      if (!trimmed) return;
      const now = Date.now();
      if (trimmed === lastSent && now - lastSentAtRef.current < 1500) return;
      lastSentAtRef.current = now;

      setSending(true);
      setError(null);
      const res = await fetch(
        `/api/pair/${encodeURIComponent(code)}/scan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcode: trimmed }),
        }
      );
      setSending(false);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not send scan.");
        return;
      }
      setLastSent(trimmed);
      if (navigator.vibrate) navigator.vibrate(60);
    },
    [code, lastSent]
  );

  if (valid === null) {
    return (
      <div className="mx-auto mt-20 max-w-md text-center text-sm text-slate-500">
        Checking pair code…
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="mx-auto mt-16 max-w-md">
        <div className="card p-6 text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            Pair code invalid
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {error ??
              "Ask the desktop user to generate a new pair code on the Scan page."}
          </p>
          <p className="mt-4 font-mono text-xs text-slate-400">{code}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-2">
      <div className="card p-4 text-center">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          Paired with
        </div>
        <div className="mt-1 font-mono text-2xl font-semibold text-slate-900">
          {code}
        </div>
        {expiresAt ? (
          <div className="mt-1 text-xs text-slate-400">
            Expires {new Date(expiresAt).toLocaleTimeString()}
          </div>
        ) : null}
      </div>

      <BarcodeScanner onResult={handleScanned} paused={!scannerOn} />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setScannerOn((v) => !v)}
          className="btn-secondary flex-1"
        >
          {scannerOn ? "Pause camera" : "Resume camera"}
        </button>
      </div>

      <div
        className={
          "rounded-md px-4 py-3 text-center text-sm " +
          (error
            ? "bg-red-50 text-red-700"
            : sending
            ? "bg-slate-100 text-slate-600"
            : lastSent
            ? "bg-emerald-50 text-emerald-800"
            : "bg-slate-100 text-slate-500")
        }
      >
        {error ? (
          error
        ) : sending ? (
          "Sending…"
        ) : lastSent ? (
          <>
            Sent <span className="font-mono">{lastSent}</span> ✓
            <div className="mt-1 text-xs text-emerald-700">
              Scan the next item.
            </div>
          </>
        ) : (
          "Point the camera at a barcode. Each scan will pop up on the paired computer."
        )}
      </div>
    </div>
  );
}
