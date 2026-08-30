import { NextRequest, NextResponse } from "next/server";
import { findHighlights } from "@/services/football/highlights";
import { recordIntegrationHealth } from "@/lib/integration-health";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const home = (params.get("home") ?? "").trim();
  const away = (params.get("away") ?? "").trim();
  const kickoff = (params.get("kickoff") ?? "").trim();
  const competition = (params.get("competition") ?? "").trim();
  const force = params.get("retry") === "1";
  if (!home || !away || home.length > 120 || away.length > 120 || competition.length > 160 || !kickoff || Number.isNaN(Date.parse(kickoff))) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  try {
    const result = await findHighlights({ home, away, kickoff, competition: competition || undefined, force });
    recordIntegrationHealth("highlights", { status: "ok", code: result.found ? "FOUND" : "NOT_FOUND" });
    return NextResponse.json(result, { headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=1800" } });
  } catch (error) {
    console.error("Highlight lookup failed", error instanceof Error ? error.message.replace(/[^A-Z0-9_:-]/gi, "").slice(0, 80) : "UNKNOWN");
    recordIntegrationHealth("highlights", { status: "error", code: "UPSTREAM" });
    return NextResponse.json({ error: "HIGHLIGHTS_UNAVAILABLE" }, { status: 503 });
  }
}
