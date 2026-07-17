import Link from "next/link";
import { FrameForm } from "@/components/FrameForm";

export default function NewFramePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← Back to inventory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          New frame
        </h1>
        <p className="text-sm text-slate-500">
          Add a frame style. Optionally set quantity, scan or type a barcode, or
          mark the first item sold — or add inventory later from Scan.
        </p>
      </div>
      <FrameForm submitLabel="Create frame" />
    </div>
  );
}
