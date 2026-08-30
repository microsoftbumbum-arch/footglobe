import { NextResponse } from "next/server";
import { getMatches } from "@/services/football";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date")?.trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "INVALID_DATE" }, { status: 400 });
  }

  try {
    const result = await getMatches(date, request.signal);
    return NextResponse.json(result.data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return NextResponse.json({
      date,
      source: "unavailable",
      coverage: "unavailable",
      matches: [],
      error: "MATCHES_UNAVAILABLE",
    }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
    });
  }
}
