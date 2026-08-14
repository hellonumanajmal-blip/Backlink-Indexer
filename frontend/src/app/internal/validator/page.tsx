import { Suspense } from "react";
import ValidatorPage from "./ValidatorClient";

export default function Page() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-[var(--muted)]">Loading validator…</main>}>
      <ValidatorPage />
    </Suspense>
  );
}
