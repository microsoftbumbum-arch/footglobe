import { NextResponse } from "next/server";
import { getFootGlobeRetroToday } from "@/lib/footglobe-retro-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const season = new URL(request.url).searchParams.get("season")?.trim();
  if (!season || !/^[A-Za-z0-9._-]{1,40}$/.test(season)) return NextResponse.json({ error: "INVALID_SEASON" }, { status: 400 });
  try {
    const data = await getFootGlobeRetroToday(season, request.signal);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } });
  } catch {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return NextResponse.json({ error: "RETRO_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
