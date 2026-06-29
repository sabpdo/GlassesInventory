"use client";

import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Modal } from "@/components/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
  title?: string;
  description?: string;
};

// Camera-based barcode scanner inside a modal. Closes itself after a
// successful scan and hands the barcode back to the caller. While closed,
// the scanner is paused so the camera light goes off.
export function ScanModal({
  open,
  onClose,
  onScanned,
  title = "Scan barcode",
  description = "Point the camera at a barcode. The dialog closes automatically when one is detected.",
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="lg"
      footer={
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancel
        </button>
      }
    >
      <BarcodeScanner
        onResult={(barcode) => {
          const trimmed = barcode.trim();
          if (!trimmed) return;
          onScanned(trimmed);
          onClose();
        }}
        paused={!open}
      />
    </Modal>
  );
}
