"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-8 flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold text-white mb-2">404 - Page Not Found</h1>
      <p className="text-slate-400 text-sm mb-6">The requested resource could not be found.</p>
      <Link href="/" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium">
        Return Home
      </Link>
    </div>
  );
}
