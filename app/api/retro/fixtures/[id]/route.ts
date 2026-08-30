import { NextResponse } from "next/server";
import { getFootGlobeRetroFixture } from "@/lib/footglobe-retro-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id || id.length > 180) return NextResponse.json({ error: "INVALID_FIXTURE" }, { status: 400 });
  try {
    const data = await getFootGlobeRetroFixture(id, request.signal);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return NextResponse.json({ error: "RETRO_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
