import Link from "next/link";
import { FrameForm } from "@/components/FrameForm";

export default function NewFramePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link
          href="/"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Back to inventory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          New frame
        </h1>
        <p className="text-sm text-slate-500">
          Add a frame style. You can attach physical items (barcodes) to it
          from the frame page or the Scan page.
        </p>
      </div>
      <FrameForm submitLabel="Create frame" />
    </div>
  );
}
