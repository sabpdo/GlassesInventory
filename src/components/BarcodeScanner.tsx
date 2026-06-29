"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onResult: (text: string) => void;
  paused?: boolean;
};

// Camera-based scanner using @zxing/browser. Kept self-contained so the page
// can also offer a typed-input fallback.
export function BarcodeScanner({ onResult, paused }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setError(null);
      setStarting(true);
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const video = videoRef.current;
        if (!video) return;

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          video,
          (result, err, ctrl) => {
            if (cancelled) {
              ctrl.stop();
              return;
            }
            if (result) {
              onResult(result.getText());
            }
          }
        );
        controlsRef.current = controls;
      } catch (e) {
        const msg =
          (e as Error)?.message ??
          "Unable to access the camera. You can still type the barcode below.";
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    if (!paused) start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [onResult, paused]);

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg bg-black aspect-video">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        {starting && !error ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
            Starting camera…
          </div>
        ) : null}
        {paused ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white">
            Camera paused
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
