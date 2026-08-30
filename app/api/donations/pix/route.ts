import { NextResponse } from "next/server";
import { createPixDonation, getPixDonationStatus } from "@/services/donations/goatpay";
import { recordIntegrationHealth } from "@/lib/integration-health";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { amount?: unknown };
    const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
    const payment = await createPixDonation(amount);
    recordIntegrationHealth("pix", { status: "ok", code: "CREATED" });
    return NextResponse.json(payment, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "PIX_CREATE_FAILED";
    const status = code === "INVALID_AMOUNT" ? 400 : code === "GOATPAY_NOT_CONFIGURED" ? 503 : 502;
    if (status >= 500) recordIntegrationHealth("pix", { status: "error", code: code === "GOATPAY_NOT_CONFIGURED" ? "NOT_CONFIGURED" : "UPSTREAM", httpStatus: status });
    return NextResponse.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id") ?? "";
    const token = url.searchParams.get("token") ?? "";
    const payment = await getPixDonationStatus(id, token);
    recordIntegrationHealth("pix", { status: "ok", code: "STATUS" });
    return NextResponse.json(payment, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "PIX_STATUS_FAILED";
    const status = code === "INVALID_PAYMENT_ID" ? 400 : code === "GOATPAY_NOT_CONFIGURED" ? 503 : 502;
    if (status >= 500) recordIntegrationHealth("pix", { status: "error", code: code === "GOATPAY_NOT_CONFIGURED" ? "NOT_CONFIGURED" : "UPSTREAM", httpStatus: status });
    return NextResponse.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
