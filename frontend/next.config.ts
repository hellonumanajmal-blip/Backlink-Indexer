import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      // IndexNow verification file: /{key}.txt (hex key) is served by a route
      // handler that checks the requested key against the INDEXNOW_KEY env var,
      // so filename and file content can never drift apart.
      {
        source: "/:key([a-f0-9]{8,128}).txt",
        destination: "/indexnow-key/:key",
      },
    ];
  },
};

// Deliberately no `/api/:path*` rewrite. A rewrite is resolved before route
// handlers, so proxying /api/* straight to the backend would shadow
// src/app/api/[...path]/route.ts entirely. That handler is what translates the
// dashboard's paths (/api/backlinks) to the backend's (/api/indexing/backlinks)
// and reshapes the payloads, so it has to stay in the request path. It reaches
// the backend itself via FASTAPI_INTERNAL_URL.

export default nextConfig;
