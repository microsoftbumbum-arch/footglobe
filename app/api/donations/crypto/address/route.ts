import { NextResponse } from "next/server";
import { describeBinanceFailure, getDepositAddress } from "@/services/donations/binance";
import { recordIntegrationHealth } from "@/lib/integration-health";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { coin?: unknown; network?: unknown; amount?: unknown };
    const coin = typeof body.coin === "string" ? body.coin : "";
    const network = typeof body.network === "string" ? body.network : "";
    const amount = body.amount === undefined || body.amount === "" ? undefined : Number(body.amount);
    const result = await getDepositAddress(coin, network, amount);
    recordIntegrationHealth("crypto", { status: "ok", code: "ADDRESS" });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "CRYPTO_ADDRESS_FAILED";
    const clientError = ["INVALID_CRYPTO_SELECTION", "UNSUPPORTED_CRYPTO_SELECTION", "CRYPTO_AMOUNT_REQUIRED"].includes(code);
    if (clientError) return NextResponse.json({ error: code }, { status: 400, headers: { "Cache-Control": "no-store" } });
    const failure = describeBinanceFailure(error);
    const status = failure.category === "config" ? 503 : failure.category === "rate_limit" ? 429 : 502;
    recordIntegrationHealth("crypto", { status: failure.category === "region_restricted" ? "blocked" : "error", code: failure.category.toUpperCase(), httpStatus: failure.status });
    return NextResponse.json({ error: "CRYPTO_ADDRESS_FAILED", reason: failure.category, retryable: failure.retryable }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
