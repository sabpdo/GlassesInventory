"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";

type PageProps = { params: { code: string } };

type SessionState =
  | { status: "loading" }
  | { status: "invalid"; message: string }
  | { status: "active"; expiresAt: string }
  | { status: "ended"; message: string };

export default function PhonePairPage({ params }: PageProps) {
  const code = params.code.toUpperCase();

  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [scannerOn, setScannerOn] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyStatus = useCallback((res: Response, data: { error?: string }) => {
    if (res.status === 404) {
      setSession({
        status: "ended",
        message:
          data.error ?? "Pairing ended — the session was closed on the computer.",
      });
      setScannerOn(false);
      return;
    }
    if (res.status === 410) {
      setSession({
        status: "ended",
        message: data.error ?? "Pair code expired.",
      });
      setScannerOn(false);
      return;
    }
    if (!res.ok) {
      setSession({
        status: "invalid",
        message: data.error ?? "Pair code is not valid.",
      });
      return;
    }
  }, []);

  // Validate once, then keep polling so we notice when the desktop ends pairing.
  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function check() {
      try {
        const res = await fetch(`/api/pair/${encodeURIComponent(code)}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (res.status === 404 || res.status === 410) {
          applyStatus(res, data);
          return;
        }
        if (!res.ok) {
          applyStatus(res, data);
          return;
        }

        setSession({ status: "active", expiresAt: data.expiresAt });
        timer = window.setTimeout(check, 2000);
      } catch {
        if (!cancelled) {
          timer = window.setTimeout(check, 3000);
        }
      }
    }

    check();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [code, applyStatus]);

  const lastSentAtRef = useRef(0);
  const handleScanned = useCallback(
    async (barcode: string) => {
      if (session.status !== "active") return;
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
        if (res.status === 404 || res.status === 410) {
          applyStatus(res, data);
          return;
        }
        setError(data.error ?? "Could not send scan.");
        return;
      }
      setLastSent(trimmed);
      if (navigator.vibrate) navigator.vibrate(60);
    },
    [code, lastSent, session.status, applyStatus]
  );

  if (session.status === "loading") {
    return (
      <div className="mx-auto mt-20 max-w-md text-center text-sm text-slate-500">
        Checking pair code…
      </div>
    );
  }

  if (session.status === "invalid" || session.status === "ended") {
    return (
      <div className="mx-auto mt-16 max-w-md">
        <div className="card p-6 text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            {session.status === "ended"
              ? "Pairing ended"
              : "Pair code invalid"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">{session.message}</p>
          <p className="mt-4 font-mono text-xs text-slate-400">{code}</p>
          {session.status === "ended" ? (
            <p className="mt-3 text-xs text-slate-400">
              Ask the desktop user to start a new pair code on the Scan page.
            </p>
          ) : null}
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
        <div className="mt-1 text-xs text-slate-400">
          Expires {new Date(session.expiresAt).toLocaleTimeString()}
        </div>
        <div className="mt-1 text-xs text-emerald-600">Connected</div>
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
