import Link from "next/link";
import { StatsPanel } from "@/components/StatsPanel";

export const dynamic = "force-dynamic";

export default function StatsPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← Back to inventory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Run stats
        </h1>
        <p className="text-sm text-slate-500">
          Current inventory and trends over any date range — calculated on the
          fly from your item history.
        </p>
      </div>
      <StatsPanel />
    </div>
  );
}
