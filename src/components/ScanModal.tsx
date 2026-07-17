"use client";

import { useEffect, useState } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Modal } from "@/components/Modal";
import { PairingPanel } from "@/components/PairingPanel";

type ScanMode = "camera" | "pair";

type Props = {
  open: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
  title?: string;
  description?: string;
  defaultMode?: ScanMode;
};

// Camera or phone pairing inside a modal. Closes after a successful scan.
export function ScanModal({
  open,
  onClose,
  onScanned,
  title = "Scan barcode",
  description,
  defaultMode = "camera",
}: Props) {
  const [mode, setMode] = useState<ScanMode>(defaultMode);

  useEffect(() => {
    if (open) setMode(defaultMode);
  }, [open, defaultMode]);

  function handleScanned(barcode: string) {
    const trimmed = barcode.trim();
    if (!trimmed) return;
    onScanned(trimmed);
    onClose();
  }

  const modeDescription =
    mode === "camera"
      ? (description ??
        "Point this device's camera at a barcode. The dialog closes when one is detected.")
      : "Scan the QR code with your phone, then scan barcodes on the phone — they appear here.";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={modeDescription}
      size="lg"
      footer={
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancel
        </button>
      }
    >
      <div
        role="tablist"
        aria-label="How to scan"
        className="mb-4 inline-flex rounded-lg bg-slate-100 p-1 text-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "camera"}
          onClick={() => setMode("camera")}
          className={
            "rounded-md px-4 py-1.5 font-medium transition " +
            (mode === "camera"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700")
          }
        >
          This device
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "pair"}
          onClick={() => setMode("pair")}
          className={
            "rounded-md px-4 py-1.5 font-medium transition " +
            (mode === "pair"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700")
          }
        >
          Pair phone
        </button>
      </div>

      {mode === "camera" ? (
        <BarcodeScanner onResult={handleScanned} paused={!open} />
      ) : (
        <PairingPanel
          enabled={open && mode === "pair"}
          onBarcode={handleScanned}
          context="field"
        />
      )}
    </Modal>
  );
}
