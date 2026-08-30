import { NextResponse } from "next/server";
import { getFootGlobeRetroTeamAsset } from "@/lib/footglobe-retro-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const safe = (value: string | null, max: number) => {
  const parsed = value?.trim();
  return parsed && parsed.length <= max ? parsed : undefined;
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const name = safe(params.get("name"), 120);
  const slug = safe(params.get("slug"), 120);
  const countryId = safe(params.get("countryId"), 120);
  if (!name) return NextResponse.json({ error: "INVALID_TEAM" }, { status: 400 });

  try {
    const asset = await getFootGlobeRetroTeamAsset(name, slug, countryId);
    return NextResponse.json(asset, {
      headers: { "Cache-Control": asset.logo ? "public, max-age=86400, stale-while-revalidate=604800" : "public, max-age=3600" },
    });
  } catch {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return NextResponse.json({ logo: null }, { status: 200, headers: { "Cache-Control": "public, max-age=300" } });
  }
}
