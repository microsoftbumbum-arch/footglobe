import { NextResponse } from "next/server";
import { describeBinanceFailure, getSupportedDepositOptions } from "@/services/donations/binance";
import { recordIntegrationHealth } from "@/lib/integration-health";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const retry = new URL(request.url).searchParams.get("retry") === "1";
    const options = await getSupportedDepositOptions(retry);
    recordIntegrationHealth("crypto", { status: "ok", code: "OPTIONS" });
    return NextResponse.json({ options }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    const failure = describeBinanceFailure(error);
    const status = failure.category === "config" ? 503 : failure.category === "rate_limit" ? 429 : 502;
    recordIntegrationHealth("crypto", { status: failure.category === "region_restricted" ? "blocked" : "error", code: failure.category.toUpperCase(), httpStatus: failure.status });
    return NextResponse.json(
      { error: "CRYPTO_OPTIONS_FAILED", reason: failure.category, retryable: failure.retryable },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
