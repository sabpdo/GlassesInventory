import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FrameForm, type FrameFormValues } from "@/components/FrameForm";

export const dynamic = "force-dynamic";

export default async function NewFramePage({
  searchParams,
}: {
  searchParams: { copyFrom?: string };
}) {
  let initial: Partial<FrameFormValues> | undefined;
  let copiedFrom: { manufacturer: string; style: string } | null = null;

  if (searchParams.copyFrom) {
    const source = await prisma.frame.findUnique({
      where: { id: searchParams.copyFrom },
      select: {
        manufacturer: true,
        style: true,
        color: true,
        cost: true,
        retailCost: true,
        size: true,
      },
    });
    if (source) {
      initial = {
        manufacturer: source.manufacturer,
        style: source.style,
        color: source.color,
        cost: String(source.cost),
        retailCost: String(source.retailCost),
        size: source.size ?? "",
      };
      copiedFrom = {
        manufacturer: source.manufacturer,
        style: source.style,
      };
    }
  }

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
          {copiedFrom ? (
            <>
              Based on{" "}
              <span className="font-medium text-slate-700">
                {copiedFrom.manufacturer} · {copiedFrom.style}
              </span>
              . Update color and other details as needed, then save.
            </>
          ) : (
            <>
              Add a frame style. Optionally set quantity, scan or type a
              barcode, or mark the first item sold — or add inventory later from
              Scan.
            </>
          )}
        </p>
      </div>
      <FrameForm submitLabel="Create frame" initial={initial} />
    </div>
  );
}
