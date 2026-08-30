import { createHmac, timingSafeEqual } from "node:crypto";

const GOATPAY_BASE = "https://api.goatpay.com.br/v1";

export interface PixCharge {
  id: string;
  status: string;
  amount: number;
  copyPaste?: string;
  qrCodeBase64?: string;
  qrcodeUrl?: string;
  expiresAt?: string;
  checkToken: string;
}

function apiKey() {
  const value = process.env.GOATPAY_API_KEY;
  if (!value) throw new Error("GOATPAY_NOT_CONFIGURED");
  return value;
}

function statusToken(id: string) {
  return createHmac("sha256", apiKey()).update(`footglobe-pix-status:${id}`).digest("hex");
}

function validStatusToken(id: string, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const expected = Buffer.from(statusToken(id), "hex");
  const received = Buffer.from(token, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

async function goatFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${GOATPAY_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "X-API-Key": apiKey(),
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(12000),
  });

  let body: unknown;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const error = new Error(`GOATPAY_HTTP_${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return body as { success?: boolean; data?: Record<string, unknown> };
}

export async function createPixDonation(amount: number): Promise<PixCharge> {
  const normalized = Math.round(amount * 100) / 100;
  if (!Number.isFinite(normalized) || normalized < 1 || normalized > 1_000_000) throw new Error("INVALID_AMOUNT");

  const externalReference = `footglobe-donation-${crypto.randomUUID()}`;
  const payload = await goatFetch("/payment-pix/create", {
    method: "POST",
    body: JSON.stringify({
      amount: normalized,
      description: "FootGlobe donation",
      coverFee: false,
      emitFiscalInvoice: false,
      expirationSeconds: 3600,
      externalReference,
    }),
  });

  const data = payload.data ?? {};
  const id = typeof data.id === "string" ? data.id : "";
  if (!id) throw new Error("GOATPAY_INVALID_RESPONSE");
  return {
    id,
    status: typeof data.status === "string" ? data.status : "PENDING",
    amount: typeof data.amount === "number" ? data.amount : normalized,
    copyPaste: typeof data.copyPaste === "string" ? data.copyPaste : undefined,
    qrCodeBase64: typeof data.qrCodeBase64 === "string" ? data.qrCodeBase64 : undefined,
    qrcodeUrl: typeof data.qrcodeUrl === "string" ? data.qrcodeUrl : undefined,
    expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : undefined,
    checkToken: statusToken(id),
  };
}

export async function getPixDonationStatus(id: string, token: string) {
  if (!/^[A-Za-z0-9_-]{3,120}$/.test(id) || !validStatusToken(id, token)) throw new Error("INVALID_PAYMENT_ID");
  const payload = await goatFetch(`/payment-pix/status/${encodeURIComponent(id)}`, { method: "GET" });
  const data = payload.data ?? {};
  return {
    id: typeof data.id === "string" ? data.id : id,
    status: typeof data.status === "string" ? data.status : "PENDING",
    amount: typeof data.amount === "number" ? data.amount : undefined,
    expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : undefined,
    completedAt: typeof data.completedAt === "string" ? data.completedAt : undefined,
  };
}
