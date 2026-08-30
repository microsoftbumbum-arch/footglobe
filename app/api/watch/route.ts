import { NextRequest, NextResponse } from "next/server";
import { getBroadcasts } from "@/services/football/watch";
import { recordIntegrationHealth } from "@/lib/integration-health";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fixtureId = (params.get("fixture") ?? "").trim();
  const home = (params.get("home") ?? "").trim();
  const away = (params.get("away") ?? "").trim();
  const date = (params.get("date") ?? "").trim();
  if (!/^[0-9A-Za-z_-]{1,128}$/.test(fixtureId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !home || !away || home.length > 120 || away.length > 120) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  try {
    const result = await getBroadcasts({ fixtureId, home, away, date });
    recordIntegrationHealth("watch", { status: "ok", code: result.matched ? "MATCHED" : "NO_LISTING" });
    return NextResponse.json(result, { headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=21600" } });
  } catch {
    recordIntegrationHealth("watch", { status: "error", code: "UPSTREAM" });
    return NextResponse.json({ error: "WATCH_UNAVAILABLE" }, { status: 503 });
  }
}
