import { createHmac } from "node:crypto";

const BINANCE_BASES = [
  "https://api.binance.com",
  "https://api-gcp.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api4.binance.com",
] as const;
const CACHE_TTL_MS = 5 * 60 * 1000;
const SERVER_TIME_TTL_MS = 60 * 1000;
const RECV_WINDOW_MS = 60_000;

export interface BinanceNetworkOption {
  network: string;
  name: string;
  isDefault: boolean;
  minConfirm: number;
  requiresAmount: boolean;
  specialTips?: string;
}

export interface BinanceCoinOption {
  coin: string;
  name: string;
  networks: BinanceNetworkOption[];
}

type BinanceConfigNetwork = {
  network?: string;
  name?: string;
  isDefault?: boolean;
  depositEnable?: boolean;
  busy?: boolean;
  minConfirm?: number;
  specialTips?: string;
};

type BinanceConfigCoin = {
  coin?: string;
  name?: string;
  depositAllEnable?: boolean;
  networkList?: BinanceConfigNetwork[];
};

export type BinanceFailureCategory = "config" | "auth" | "clock" | "rate_limit" | "network" | "region_restricted" | "upstream" | "invalid_response";

export class BinanceApiError extends Error {
  readonly status?: number;
  readonly apiCode?: number;
  readonly category: BinanceFailureCategory;
  readonly retryable: boolean;
  readonly endpoint: string;

  constructor(message: string, options: { status?: number; apiCode?: number; category: BinanceFailureCategory; retryable: boolean; endpoint: string }) {
    super(message);
    this.name = "BinanceApiError";
    this.status = options.status;
    this.apiCode = options.apiCode;
    this.category = options.category;
    this.retryable = options.retryable;
    this.endpoint = options.endpoint;
  }
}

let optionsCache: { expires: number; options: BinanceCoinOption[] } | null = null;
let timeCache: { expires: number; offsetMs: number; base: string } | null = null;

// If Binance's account-wide coin catalogue is temporarily unavailable, keep the
// donation flow usable by asking Binance for the account's default deposit
// address for a conservative set of widely supported assets. The signed
// deposit-address endpoint accepts an omitted network and lets Binance choose
// the account default. Dynamic account options always win when available.
const FALLBACK_DEPOSIT_COINS = [
  ["BTC", "Bitcoin"], ["ETH", "Ethereum"], ["USDT", "Tether USD"],
  ["USDC", "USDC"], ["BNB", "BNB"], ["SOL", "Solana"],
  ["XRP", "XRP"], ["DOGE", "Dogecoin"], ["ADA", "Cardano"],
  ["TRX", "TRON"], ["LTC", "Litecoin"], ["BCH", "Bitcoin Cash"],
] as const;

function fallbackDepositOptions(): BinanceCoinOption[] {
  return FALLBACK_DEPOSIT_COINS.map(([coin, name]) => ({
    coin,
    name,
    networks: [{
      network: "AUTO",
      name: "Binance default",
      isDefault: true,
      minConfirm: 0,
      requiresAmount: false,
      specialTips: "Binance will select the default deposit network for this asset.",
    }],
  }));
}

function credentials() {
  const key = process.env.BINANCE_API_KEY?.trim();
  const secret = process.env.BINANCE_API_SECRET?.trim();
  if (!key || !secret) {
    throw new BinanceApiError("BINANCE_NOT_CONFIGURED", { category: "config", retryable: false, endpoint: "credentials" });
  }
  return { key, secret };
}

function classify(status: number | undefined, code: number | undefined): Pick<BinanceApiError, "category" | "retryable"> {
  if (code === -1021) return { category: "clock", retryable: true };
  if (code === -1022 || code === -2014 || code === -2015) return { category: "auth", retryable: false };
  if (status === 418 || status === 429 || code === -1003) return { category: "rate_limit", retryable: true };
  if (status === 451) return { category: "region_restricted", retryable: false };
  if (status === 401 || status === 403) return { category: "auth", retryable: false };
  if (status && status >= 500) return { category: "upstream", retryable: true };
  return { category: "upstream", retryable: false };
}

function safeLog(error: BinanceApiError) {
  // Never log request query strings, headers, signatures, raw Binance bodies or credentials.
  console.warn("[footglobe:binance] request failed", {
    endpoint: error.endpoint,
    status: error.status ?? null,
    code: error.apiCode ?? null,
    category: error.category,
    retryable: error.retryable,
  });
}

async function parseBinanceError(response: Response, endpoint: string): Promise<BinanceApiError> {
  let apiCode: number | undefined;
  try {
    const payload = await response.json() as { code?: unknown };
    if (typeof payload.code === "number" && Number.isFinite(payload.code)) apiCode = payload.code;
  } catch {
    // Some proxy/WAF responses are not JSON. Status is enough for safe diagnostics.
  }
  const details = classify(response.status, apiCode);
  return new BinanceApiError("BINANCE_REQUEST_FAILED", {
    endpoint,
    status: response.status,
    apiCode,
    category: details.category,
    retryable: details.retryable,
  });
}

async function getServerOffset(force = false): Promise<{ offsetMs: number; base: string }> {
  if (!force && timeCache && timeCache.expires > Date.now()) return timeCache;
  let lastError: BinanceApiError | null = null;

  for (const base of BINANCE_BASES) {
    const started = Date.now();
    try {
      const response = await fetch(`${base}/api/v3/time`, {
        cache: "no-store",
        signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) {
        lastError = await parseBinanceError(response, "/api/v3/time");
        continue;
      }
      const payload = await response.json() as { serverTime?: unknown };
      if (typeof payload.serverTime !== "number" || !Number.isFinite(payload.serverTime)) {
        lastError = new BinanceApiError("BINANCE_INVALID_TIME_RESPONSE", { category: "invalid_response", retryable: true, endpoint: "/api/v3/time" });
        continue;
      }
      const finished = Date.now();
      const midpoint = started + Math.round((finished - started) / 2);
      timeCache = { expires: finished + SERVER_TIME_TTL_MS, offsetMs: payload.serverTime - midpoint, base };
      return timeCache;
    } catch {
      lastError = new BinanceApiError("BINANCE_NETWORK_ERROR", { category: "network", retryable: true, endpoint: "/api/v3/time" });
    }
  }

  if (lastError) safeLog(lastError);
  // A public server-time request can be filtered independently from signed
  // Wallet/SAPI traffic on some hosts. Discloud's system clock is normally
  // NTP-synchronised, so continue with local time and the maximum recvWindow.
  // If it is actually skewed, signedGet handles Binance -1021 by resyncing.
  if (!lastError || ["network", "upstream", "invalid_response"].includes(lastError.category)) {
    return { offsetMs: 0, base: BINANCE_BASES[0] };
  }
  throw lastError;
}

async function signedGet(path: string, params: Record<string, string | number | boolean | undefined> = {}, attempt = 0): Promise<unknown> {
  const { key, secret } = credentials();
  const time = await getServerOffset(attempt > 0);
  const bases = [time.base, ...BINANCE_BASES.filter((base) => base !== time.base)];
  let lastError: BinanceApiError | null = null;

  for (const base of bases) {
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(params)) if (value !== undefined) query.set(name, String(value));
    query.set("recvWindow", String(RECV_WINDOW_MS));
    query.set("timestamp", String(Date.now() + time.offsetMs));
    const signature = createHmac("sha256", secret).update(query.toString()).digest("hex");
    query.set("signature", signature);

    try {
      const response = await fetch(`${base}${path}?${query.toString()}`, {
        method: "GET",
        headers: { "X-MBX-APIKEY": key },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });

      if (response.ok) {
        try {
          return await response.json() as unknown;
        } catch {
          throw new BinanceApiError("BINANCE_INVALID_RESPONSE", { category: "invalid_response", retryable: true, endpoint: path });
        }
      }

      const error = await parseBinanceError(response, path);
      lastError = error;

      // A timestamp error is recoverable by resyncing once. Auth/permission/IP errors are not retried.
      if (error.apiCode === -1021 && attempt === 0) {
        timeCache = null;
        return signedGet(path, params, 1);
      }
      if (!error.retryable || error.category === "rate_limit") {
        safeLog(error);
        throw error;
      }
      // 5xx/network-style failures may use another official Binance base endpoint.
    } catch (error) {
      if (error instanceof BinanceApiError) {
        if (!error.retryable || error.category === "rate_limit") throw error;
        lastError = error;
      } else {
        lastError = new BinanceApiError("BINANCE_NETWORK_ERROR", { category: "network", retryable: true, endpoint: path });
      }
    }
  }

  if (lastError) safeLog(lastError);
  throw lastError ?? new BinanceApiError("BINANCE_NETWORK_ERROR", { category: "network", retryable: true, endpoint: path });
}

export function describeBinanceFailure(error: unknown) {
  if (error instanceof BinanceApiError) {
    return {
      error: error.message,
      category: error.category,
      retryable: error.retryable,
      status: error.status,
      code: error.apiCode,
    };
  }
  return { error: "BINANCE_UNKNOWN_ERROR", category: "upstream" as const, retryable: false };
}

export async function getSupportedDepositOptions(force = false): Promise<BinanceCoinOption[]> {
  if (!force && optionsCache && optionsCache.expires > Date.now()) return optionsCache.options;
  let raw: unknown;
  try {
    raw = await signedGet("/sapi/v1/capital/config/getall");
  } catch (error) {
    if (error instanceof BinanceApiError && ["network", "upstream", "rate_limit", "invalid_response"].includes(error.category)) {
      const fallback = fallbackDepositOptions();
      optionsCache = { expires: Date.now() + 60_000, options: fallback };
      return fallback;
    }
    throw error;
  }
  if (!Array.isArray(raw)) {
    const fallback = fallbackDepositOptions();
    optionsCache = { expires: Date.now() + 60_000, options: fallback };
    return fallback;
  }

  const options = (raw as BinanceConfigCoin[])
    .map((item): BinanceCoinOption | null => {
      const coin = typeof item.coin === "string" ? item.coin.toUpperCase() : "";
      if (!coin || item.depositAllEnable === false) return null;
      const networks = (item.networkList ?? [])
        .filter((network) => network.depositEnable === true && network.busy !== true && typeof network.network === "string")
        .map((network) => ({
          network: network.network as string,
          name: typeof network.name === "string" && network.name ? network.name : network.network as string,
          isDefault: network.isDefault === true,
          minConfirm: Number.isFinite(network.minConfirm) ? Number(network.minConfirm) : 0,
          requiresAmount: network.network?.toUpperCase() === "LIGHTNING",
          specialTips: typeof network.specialTips === "string" && network.specialTips.trim() ? network.specialTips.trim().slice(0, 240) : undefined,
        }));
      if (!networks.length) return null;
      return { coin, name: typeof item.name === "string" && item.name ? item.name : coin, networks };
    })
    .filter((item): item is BinanceCoinOption => Boolean(item))
    .sort((a, b) => a.coin.localeCompare(b.coin));

  if (!options.length) {
    const fallback = fallbackDepositOptions();
    optionsCache = { expires: Date.now() + 60_000, options: fallback };
    return fallback;
  }
  optionsCache = { expires: Date.now() + CACHE_TTL_MS, options };
  return options;
}

export async function getDepositAddress(coinInput: string, networkInput: string, amountInput?: number) {
  const coin = coinInput.trim().toUpperCase();
  const network = networkInput.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,24}$/.test(coin) || !/^[A-Z0-9_-]{1,40}$/.test(network)) throw new Error("INVALID_CRYPTO_SELECTION");

  const options = await getSupportedDepositOptions();
  const selectedCoin = options.find((item) => item.coin === coin);
  const selectedNetwork = selectedCoin?.networks.find((item) => item.network.toUpperCase() === network);
  if (!selectedCoin || !selectedNetwork) throw new Error("UNSUPPORTED_CRYPTO_SELECTION");

  const params: Record<string, string | number> = { coin };
  if (selectedNetwork.network.toUpperCase() !== "AUTO") params.network = selectedNetwork.network;
  if (selectedNetwork.requiresAmount) {
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("CRYPTO_AMOUNT_REQUIRED");
    params.amount = amount;
  }

  const raw = await signedGet("/sapi/v1/capital/deposit/address", params) as Record<string, unknown>;
  const address = typeof raw.address === "string" ? raw.address.trim() : "";
  if (!address) throw new BinanceApiError("BINANCE_INVALID_ADDRESS_RESPONSE", { category: "invalid_response", retryable: true, endpoint: "/sapi/v1/capital/deposit/address" });
  const resolvedNetwork = typeof raw.network === "string" && raw.network.trim() ? raw.network.trim() : selectedNetwork.network;
  return {
    coin,
    network: resolvedNetwork,
    networkName: resolvedNetwork === "AUTO" ? selectedNetwork.name : resolvedNetwork,
    minConfirm: selectedNetwork.minConfirm,
    address,
    tag: typeof raw.tag === "string" && raw.tag.trim() ? raw.tag.trim() : undefined,
    explorerUrl: typeof raw.url === "string" && /^https:\/\//.test(raw.url) ? raw.url : undefined,
  };
}

export async function verifyDeposit(input: { coin: string; network: string; address: string; tag?: string; txId: string; startedAt?: number }) {
  const coin = input.coin.trim().toUpperCase();
  const network = input.network.trim().toUpperCase();
  const txId = input.txId.trim();
  if (!/^[A-Z0-9]{1,24}$/.test(coin) || !/^[A-Z0-9_-]{1,40}$/.test(network) || txId.length < 6 || txId.length > 200 || input.address.length < 3 || input.address.length > 256 || (input.tag?.length ?? 0) > 128) {
    throw new Error("INVALID_DEPOSIT_CHECK");
  }
  const startTime = Math.max(Date.now() - 90 * 24 * 60 * 60 * 1000, Number(input.startedAt) || Date.now() - 24 * 60 * 60 * 1000);
  const raw = await signedGet("/sapi/v1/capital/deposit/hisrec", { coin, txId, startTime, endTime: Date.now(), limit: 20 });
  if (!Array.isArray(raw)) throw new BinanceApiError("BINANCE_INVALID_RESPONSE", { category: "invalid_response", retryable: true, endpoint: "/sapi/v1/capital/deposit/hisrec" });

  const normalizeAddress = (value: unknown) => String(value ?? "").trim();
  const match = (raw as Array<Record<string, unknown>>).find((item) =>
    String(item.txId ?? "") === txId &&
    String(item.coin ?? "").toUpperCase() === coin &&
    (network === "AUTO" || String(item.network ?? "").toUpperCase() === network) &&
    normalizeAddress(item.address) === normalizeAddress(input.address) &&
    (!input.tag || String(item.addressTag ?? "") === input.tag)
  );

  if (!match) return { status: "WAITING" as const };
  const status = Number(match.status);
  if (status === 1) {
    return {
      status: "CONFIRMED" as const,
      amount: typeof match.amount === "string" ? match.amount : undefined,
      confirmations: typeof match.confirmTimes === "string" ? match.confirmTimes : undefined,
    };
  }
  if ([2, 7].includes(status)) return { status: "FAILED" as const };
  return { status: "PENDING" as const, confirmations: typeof match.confirmTimes === "string" ? match.confirmTimes : undefined };
}
