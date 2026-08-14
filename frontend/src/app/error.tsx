"use client";

import React from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-8 flex flex-col items-center justify-center">
      <h2 className="text-2xl font-bold text-white mb-2">An error occurred</h2>
      <p className="text-slate-400 text-sm mb-6">{error?.message || "An unexpected application error occurred."}</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium"
      >
        Try again
      </button>
    </div>
  );
}
