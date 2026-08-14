import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    version: "1.0.0",
    service: "pintdown-discovery-accelerator",
    timestamp: new Date().toISOString(),
  });
}
