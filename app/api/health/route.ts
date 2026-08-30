import { NextResponse } from "next/server";
import { getIntegrationHealth } from "@/lib/integration-health";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    integrations: getIntegrationHealth(),
  }, { headers: { "Cache-Control": "no-store" } });
}
