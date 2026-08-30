import { NextResponse } from "next/server";
import { getLiveMatches } from "@/services/football";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const result = await getLiveMatches(request.signal);
    const maxAge = Math.max(0, Math.min(result.maxAge, 15));
    return NextResponse.json(result.data, {
      headers: { "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=15` },
    });
  } catch {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return NextResponse.json({ error: "MATCHES_UNAVAILABLE", matches: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
