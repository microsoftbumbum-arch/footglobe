import { NextResponse } from "next/server";
import { getFootGlobeRetroSeasons } from "@/lib/footglobe-retro-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const data = await getFootGlobeRetroSeasons(request.signal);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return NextResponse.json({ error: "RETRO_UNAVAILABLE", seasons: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
