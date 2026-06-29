import { Suspense } from "react";
import { InventoryGrid } from "@/components/InventoryGrid";

export const dynamic = "force-dynamic";

export default function HomePage() {
  // Suspense is required because InventoryGrid uses useSearchParams() to
  // hydrate filter state from the URL.
  return (
    <Suspense fallback={null}>
      <InventoryGrid />
    </Suspense>
  );
}
