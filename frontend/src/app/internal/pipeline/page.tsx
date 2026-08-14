import { Suspense } from "react";
import PipelineClient from "./PipelineClient";

export default function Page() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-[var(--muted)]">Loading pipeline…</main>}>
      <PipelineClient />
    </Suspense>
  );
}
