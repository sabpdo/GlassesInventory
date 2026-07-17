"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  enabled: boolean;
  onBarcode: (barcode: string) => void;
};

type Session = {
  code: string;
  expiresAt: string;
  pairUrl?: string;
  appOrigin?: string;
};

export function PairingPanel({ enabled, onBarcode }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pairUrl, setPairUrl] = useState<string | null>(null);
  const [appOrigin, setAppOrigin] = useState<string | null>(null);
  const [lastReceived, setLastReceived] = useState<string | null>(null);
  const cursorRef = useRef<string>(new Date(0).toISOString());
  const sessionCodeRef = useRef<string | null>(null);
  const onBarcodeRef = useRef(onBarcode);

  useEffect(() => {
    onBarcodeRef.current = onBarcode;
  }, [onBarcode]);

  useEffect(() => {
    sessionCodeRef.current = session?.code ?? null;
  }, [session]);

  const closeSession = useCallback(async (code: string) => {
    try {
      await fetch(`/api/pair/${encodeURIComponent(code)}`, {
        method: "DELETE",
        keepalive: true,
      });
    } catch {
      // Best-effort
    }
  }, []);

  const clearLocal = useCallback(() => {
    setSession(null);
    setQrDataUrl(null);
    setPairUrl(null);
    setAppOrigin(null);
    setLastReceived(null);
    cursorRef.current = new Date(0).toISOString();
    sessionCodeRef.current = null;
  }, []);

  const endPairing = useCallback(async () => {
    const code = sessionCodeRef.current;
    if (code) await closeSession(code);
    clearLocal();
    setError(null);
  }, [clearLocal, closeSession]);

  async function createSession() {
    setCreating(true);
    setError(null);

    const existing = sessionCodeRef.current;
    if (existing) await closeSession(existing);

    clearLocal();
    try {
      const res = await fetch("/api/pair", { method: "POST" });
      if (!res.ok) throw new Error("Could not create pair code");
      const data: Session = await res.json();
      setSession(data);
      sessionCodeRef.current = data.code;

      const origin = data.appOrigin ?? window.location.origin;
      setAppOrigin(origin);
      const url = data.pairUrl ?? `${origin}/p/${data.code}`;
      setPairUrl(url);

      const { default: QRCode } = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(url, {
        margin: 1,
        width: 240,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (enabled && !session && !creating) {
      createSession();
    }
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (enabled) return;
    const code = sessionCodeRef.current;
    if (!code) return;
    closeSession(code);
    clearLocal();
  }, [enabled, clearLocal, closeSession]);

  useEffect(() => {
    return () => {
      const code = sessionCodeRef.current;
      if (code) {
        fetch(`/api/pair/${encodeURIComponent(code)}`, {
          method: "DELETE",
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled || !session?.code) return;
    const code = session.code;
    let stopped = false;

    async function tick() {
      if (stopped) return;
      try {
        const since = cursorRef.current;
        const res = await fetch(
          `/api/pair/${encodeURIComponent(code)}?since=${encodeURIComponent(since)}`,
          { cache: "no-store" }
        );
        if (res.status === 410 || res.status === 404) {
          setError("Pair code expired. Generate a new one.");
          clearLocal();
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (data.lastBarcode && data.lastBarcodeAt) {
            cursorRef.current = data.lastBarcodeAt;
            setLastReceived(data.lastBarcode);
            onBarcodeRef.current(data.lastBarcode);
          }
        }
      } catch {
        // network blip
      } finally {
        if (!stopped) timer = window.setTimeout(tick, 800);
      }
    }

    let timer = window.setTimeout(tick, 300);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [enabled, session?.code, clearLocal]);

  if (!enabled) return null;

  const originMismatch =
    appOrigin != null && appOrigin !== window.location.origin;

  return (
    <div className="space-y-4">
      {originMismatch ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Phone scans won&apos;t show up here</p>
          <p className="mt-1">
            This computer is on{" "}
            <span className="font-mono text-xs">{window.location.origin}</span>,
            but the QR code sends your phone to{" "}
            <span className="font-mono text-xs">{appOrigin}</span>. Both devices
            must use the same site.
          </p>
          <a
            href={`${appOrigin}/scan?mode=pair`}
            className="btn-primary mt-3 inline-flex text-sm"
          >
            Open scan page on {appOrigin.replace(/^https?:\/\//, "")}
          </a>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!session ? (
        <div className="text-center">
          <button
            type="button"
            onClick={createSession}
            disabled={creating}
            className="btn-primary"
          >
            {creating ? "Generating…" : "Generate pair code"}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="grid items-center gap-6 sm:grid-cols-[auto,1fr]">
            <div className="flex flex-col items-center">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt={`QR code for ${session.code}`}
                  className="h-60 w-60 rounded-md ring-1 ring-slate-200"
                />
              ) : (
                <div className="h-60 w-60 animate-pulse rounded-md bg-slate-100" />
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Pair code
              </div>
              <div className="mt-1 font-mono text-3xl font-semibold text-slate-900">
                {session.code}
              </div>
              <ol className="mt-4 space-y-2 text-sm text-slate-600">
                <li>
                  <span className="font-medium text-slate-900">1.</span> On your
                  phone, scan the QR code or open the link below.
                </li>
                <li>
                  <span className="font-medium text-slate-900">2.</span> Scan
                  barcodes on the phone — results appear on this computer.
                </li>
                <li>
                  <span className="font-medium text-slate-900">3.</span> Finish
                  each scan below (sold? attach to frame?).
                </li>
              </ol>
              {pairUrl ? (
                <p className="mt-3 break-all font-mono text-xs text-slate-500">
                  {pairUrl}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={createSession}
                  className="btn-secondary"
                >
                  New code
                </button>
                {pairUrl ? (
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(pairUrl)}
                    className="btn-secondary"
                  >
                    Copy phone link
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={endPairing}
                  className="btn-secondary text-red-700 ring-red-200 hover:bg-red-50"
                >
                  End pairing
                </button>
              </div>
              {lastReceived ? (
                <p className="mt-3 text-xs text-emerald-700">
                  Last scan received:{" "}
                  <span className="font-mono">{lastReceived}</span>
                </p>
              ) : (
                <p className="mt-3 text-xs text-slate-400">
                  Waiting for phone scan…
                </p>
              )}
              <div className="mt-2 text-xs text-slate-400">
                Expires {new Date(session.expiresAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
