"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  enabled: boolean;
  onBarcode: (barcode: string) => void;
};

type Session = { code: string; expiresAt: string };

// Generates a pair code and polls for incoming scans from the phone. When a
// new scan arrives, hands it off to the parent (which runs it through the
// same "Is this sold?" / "Attach to frame" UI as a local scan).
export function PairingPanel({ enabled, onBarcode }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pairUrl, setPairUrl] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const sessionCodeRef = useRef<string | null>(null);

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
      // Best-effort — phone poll will eventually see expiry anyway.
    }
  }, []);

  const clearLocal = useCallback(() => {
    setSession(null);
    setQrDataUrl(null);
    setPairUrl(null);
    cursorRef.current = null;
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
    cursorRef.current = new Date().toISOString();
    try {
      const res = await fetch("/api/pair", { method: "POST" });
      if (!res.ok) throw new Error("Could not create pair code");
      const data: Session = await res.json();
      setSession(data);
      sessionCodeRef.current = data.code;

      const url = `${window.location.origin}/p/${data.code}`;
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

  // Auto-create a session when the user switches to this tab.
  useEffect(() => {
    if (enabled && !session && !creating) {
      createSession();
    }
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the user leaves "Pair phone" mode, end the session on the server
  // so the phone page stops too.
  useEffect(() => {
    if (enabled) return;
    const code = sessionCodeRef.current;
    if (!code) return;
    closeSession(code);
    clearLocal();
  }, [enabled, clearLocal, closeSession]);

  // Close the session when this panel unmounts (navigate away, etc.).
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

  // Poll for scans from the phone.
  useEffect(() => {
    if (!enabled || !session) return;
    let stopped = false;

    async function tick() {
      if (stopped) return;
      try {
        const since = cursorRef.current ?? new Date(0).toISOString();
        if (!session) return;
        const res = await fetch(
          `/api/pair/${session.code}?since=${encodeURIComponent(since)}`,
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
            onBarcode(data.lastBarcode);
          }
        }
      } catch {
        // network blip; just keep going
      } finally {
        if (!stopped) timer = window.setTimeout(tick, 1500);
      }
    }

    let timer = window.setTimeout(tick, 500);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [enabled, session, onBarcode, clearLocal]);

  if (!enabled) return null;

  return (
    <div className="space-y-4">
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
                  phone, scan the QR code, or open{" "}
                  {pairUrl ? (
                    <span className="font-mono text-xs text-slate-500">
                      {pairUrl}
                    </span>
                  ) : null}
                  .
                </li>
                <li>
                  <span className="font-medium text-slate-900">2.</span> The
                  phone page works without logging in — point and scan.
                </li>
                <li>
                  <span className="font-medium text-slate-900">3.</span> Each
                  scan pops up below — finish the &quot;Is this sold?&quot; flow
                  on this computer.
                </li>
              </ol>
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
                    Copy link
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
              <div className="mt-3 text-xs text-slate-400">
                Expires{" "}
                {new Date(session.expiresAt).toLocaleTimeString()}
                {" · "}
                End pairing closes the phone scanner too.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
