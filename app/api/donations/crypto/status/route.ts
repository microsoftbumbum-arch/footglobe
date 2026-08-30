import { NextResponse } from "next/server";
import { describeBinanceFailure, verifyDeposit } from "@/services/donations/binance";
import { recordIntegrationHealth } from "@/lib/integration-health";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const result = await verifyDeposit({
      coin: typeof body.coin === "string" ? body.coin : "",
      network: typeof body.network === "string" ? body.network : "",
      address: typeof body.address === "string" ? body.address : "",
      tag: typeof body.tag === "string" ? body.tag : undefined,
      txId: typeof body.txId === "string" ? body.txId : "",
      startedAt: typeof body.startedAt === "number" ? body.startedAt : undefined,
    });
    recordIntegrationHealth("crypto", { status: "ok", code: "VERIFY" });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "CRYPTO_STATUS_FAILED";
    if (code === "INVALID_DEPOSIT_CHECK") return NextResponse.json({ error: code }, { status: 400, headers: { "Cache-Control": "no-store" } });
    const failure = describeBinanceFailure(error);
    const status = failure.category === "config" ? 503 : failure.category === "rate_limit" ? 429 : 502;
    recordIntegrationHealth("crypto", { status: failure.category === "region_restricted" ? "blocked" : "error", code: failure.category.toUpperCase(), httpStatus: failure.status });
    return NextResponse.json({ error: "CRYPTO_STATUS_FAILED", reason: failure.category, retryable: failure.retryable }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
