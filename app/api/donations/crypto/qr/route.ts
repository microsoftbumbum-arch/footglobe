import { makeQrSvg } from "@/services/donations/qr";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const value = new URL(request.url).searchParams.get("value") ?? "";
    const svg = makeQrSvg(value);
    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, max-age=300",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Invalid QR payload", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
}
