"use client";

import { Check, Copy, ExternalLink, Heart, LoaderCircle, QrCode, RefreshCw, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/I18nProvider";

type Method = "pix" | "crypto";

type PixPayment = {
  id: string;
  status: string;
  amount: number;
  copyPaste?: string;
  qrCodeBase64?: string;
  qrcodeUrl?: string;
  expiresAt?: string;
  checkToken: string;
};

type CryptoNetwork = {
  network: string;
  name: string;
  isDefault: boolean;
  minConfirm: number;
  requiresAmount: boolean;
  specialTips?: string;
};

type CryptoCoin = { coin: string; name: string; networks: CryptoNetwork[] };
type CryptoAddress = {
  coin: string;
  network: string;
  networkName: string;
  minConfirm: number;
  address: string;
  tag?: string;
  explorerUrl?: string;
};

function prefersBrazil() {
  if (typeof navigator === "undefined") return false;
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const language of languages) {
    try {
      const region = new Intl.Locale(language).region;
      if (region) return region.toUpperCase() === "BR";
    } catch { /* ignore malformed browser locale */ }
  }
  return false;
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export function DonationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { locale, t } = useI18n();
  const [method, setMethod] = useState<Method>("crypto");
  const [amount, setAmount] = useState("1.00");
  const [pix, setPix] = useState<PixPayment | null>(null);
  const [pixBusy, setPixBusy] = useState(false);
  const [pixError, setPixError] = useState("");
  const [copied, setCopied] = useState("");
  const [coins, setCoins] = useState<CryptoCoin[]>([]);
  const [coin, setCoin] = useState("");
  const [network, setNetwork] = useState("");
  const [cryptoAmount, setCryptoAmount] = useState("");
  const [cryptoAddress, setCryptoAddress] = useState<CryptoAddress | null>(null);
  const [cryptoBusy, setCryptoBusy] = useState(false);
  const [cryptoError, setCryptoError] = useState("");
  const [txId, setTxId] = useState("");
  const [cryptoStatus, setCryptoStatus] = useState<"" | "WAITING" | "PENDING" | "CONFIRMED" | "FAILED">("");
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const sessionStartedAt = useRef(Date.now());

  useEffect(() => {
    if (!open) return;
    setMethod(prefersBrazil() ? "pix" : "crypto");
    sessionStartedAt.current = Date.now();
  }, [open]);

  const loadCryptoOptions = useCallback(async (force = false) => {
    setCryptoBusy(true);
    setCryptoError("");
    try {
      const response = await fetch(`/api/donations/crypto/options${force ? "?retry=1" : ""}`, { cache: "no-store" });
      const payload = await response.json() as { options?: CryptoCoin[]; error?: string; retryable?: boolean };
      if (!response.ok || !payload.options?.length) {
        throw new Error(payload.error || "CRYPTO_OPTIONS_FAILED");
      }
      setCoins(payload.options);
      setOptionsLoaded(true);
      const first = payload.options[0];
      setCoin(first.coin);
      const defaultNetwork = first.networks.find((item) => item.isDefault) ?? first.networks[0];
      setNetwork(defaultNetwork?.network ?? "");
    } catch {
      setCoins([]);
      setCoin("");
      setNetwork("");
      setCryptoError(t("donationCryptoUnavailable"));
    } finally {
      setCryptoBusy(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open || method !== "crypto" || optionsLoaded || cryptoBusy || cryptoError) return;
    void loadCryptoOptions(false);
  }, [open, method, optionsLoaded, cryptoBusy, cryptoError, loadCryptoOptions]);

  useEffect(() => {
    if (!pix || !open || pix.status === "COMPLETED" || ["FAILED", "CANCELED", "REVERSED"].includes(pix.status)) return;
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(`/api/donations/pix?id=${encodeURIComponent(pix.id)}&token=${encodeURIComponent(pix.checkToken)}`, { cache: "no-store" });
        const status = await response.json() as { status?: string; expiresAt?: string };
        if (active && response.ok && status.status) setPix((current) => current ? { ...current, status: status.status!, expiresAt: status.expiresAt ?? current.expiresAt } : current);
      } catch { /* next poll can recover */ }
    };
    const timer = window.setInterval(poll, 5000);
    void poll();
    return () => { active = false; window.clearInterval(timer); };
  }, [open, pix?.id, pix?.status]);

  const selectedCoin = useMemo(() => coins.find((item) => item.coin === coin), [coin, coins]);
  const selectedNetwork = useMemo(() => selectedCoin?.networks.find((item) => item.network === network), [network, selectedCoin]);

  const chooseCoin = (next: string) => {
    setCoin(next);
    setCryptoAddress(null);
    setCryptoStatus("");
    const item = coins.find((entry) => entry.coin === next);
    const preferred = item?.networks.find((entry) => entry.isDefault) ?? item?.networks[0];
    setNetwork(preferred?.network ?? "");
  };

  const chooseNetwork = (next: string) => {
    setNetwork(next);
    setCryptoAddress(null);
    setCryptoStatus("");
  };

  const generatePix = async () => {
    const numeric = Number(amount.replace(",", "."));
    if (!Number.isFinite(numeric) || numeric < 1) {
      setPixError(t("donationMinimumError"));
      return;
    }
    setPixBusy(true);
    setPixError("");
    setPix(null);
    try {
      const response = await fetch("/api/donations/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: numeric }),
      });
      const payload = await response.json() as PixPayment & { error?: string };
      if (!response.ok || !payload.id) throw new Error(payload.error || "PIX_CREATE_FAILED");
      setPix(payload);
    } catch {
      setPixError(t("donationPaymentError"));
    } finally {
      setPixBusy(false);
    }
  };

  const generateCrypto = async () => {
    if (!coin || !network) return;
    const numericCryptoAmount = Number(cryptoAmount.replace(",", "."));
    if (selectedNetwork?.requiresAmount && (!Number.isFinite(numericCryptoAmount) || numericCryptoAmount <= 0)) {
      setCryptoError(t("donationCryptoAmountRequired"));
      return;
    }
    setCryptoBusy(true);
    setCryptoError("");
    setCryptoAddress(null);
    setCryptoStatus("");
    setTxId("");
    sessionStartedAt.current = Date.now();
    try {
      const response = await fetch("/api/donations/crypto/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coin, network, amount: selectedNetwork?.requiresAmount ? numericCryptoAmount : undefined }),
      });
      const payload = await response.json() as CryptoAddress & { error?: string };
      if (!response.ok || !payload.address) throw new Error(payload.error || "CRYPTO_ADDRESS_FAILED");
      setCryptoAddress(payload);
    } catch {
      setCryptoError(t("donationCryptoUnavailable"));
    } finally {
      setCryptoBusy(false);
    }
  };

  const verifyCrypto = async () => {
    if (!cryptoAddress || !txId.trim()) return;
    setCryptoBusy(true);
    setCryptoError("");
    try {
      const response = await fetch("/api/donations/crypto/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cryptoAddress, txId: txId.trim(), startedAt: sessionStartedAt.current - 10 * 60 * 1000 }),
      });
      const payload = await response.json() as { status?: "WAITING" | "PENDING" | "CONFIRMED" | "FAILED"; error?: string };
      if (!response.ok || !payload.status) throw new Error(payload.error || "CRYPTO_STATUS_FAILED");
      setCryptoStatus(payload.status);
    } catch {
      setCryptoError(t("donationVerificationError"));
    } finally {
      setCryptoBusy(false);
    }
  };

  const copy = async (key: string, value: string) => {
    try {
      await copyText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => current === key ? "" : current), 1800);
    } catch { /* clipboard can be restricted */ }
  };

  const pixConfirmed = pix?.status === "COMPLETED";
  const pixWaiting = pix && !pixConfirmed && !["FAILED", "CANCELED", "REVERSED"].includes(pix.status);
  const amountFormatted = new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(Number(amount.replace(",", ".")) || 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="donation-dialog">
        <DialogHeader>
          <div className="donation-title-row"><span className="donation-heart"><Heart size={18} fill="currentColor" /></span><DialogTitle>{t("donate")}</DialogTitle></div>
          <DialogDescription>{t("donateReason")}</DialogDescription>
        </DialogHeader>

        <div className="donation-methods" role="tablist" aria-label={t("donationMethod")}>
          <button role="tab" aria-selected={method === "pix"} className={method === "pix" ? "selected" : ""} onClick={() => setMethod("pix")}>{t("donatePix")} <small>Goat Pay · {t("donationBrazil")}</small></button>
          <button role="tab" aria-selected={method === "crypto"} className={method === "crypto" ? "selected" : ""} onClick={() => { setMethod("crypto"); setCryptoError(""); setCryptoAddress(null); setCryptoStatus(""); }}><Wallet size={14} /> {t("donateCrypto")} <small>Binance · {t("donationInternational")}</small></button>
        </div>

        {method === "pix" ? (
          <div className="donation-pane">
            {!pix && <>
              <label className="donation-field"><span>{t("donationAmount")}</span><div className="money-input"><b>R$</b><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ""))} aria-label={t("donationAmount")} /></div><small>{t("donationMinimumBRL")}</small></label>
              {pixError && <p className="donation-error" role="alert">{pixError}</p>}
              <button className="donation-primary" onClick={generatePix} disabled={pixBusy}>{pixBusy ? <LoaderCircle className="spin" size={16} /> : <QrCode size={16} />}{t("generatePayment")} · {amountFormatted}</button>
            </>}

            {pix && <div className="payment-result">
              {pixConfirmed ? <div className="donation-success"><Check size={24} /><strong>{t("paymentConfirmed")}</strong><p>{t("donationThanks")}</p></div> : <>
                <div className="payment-status waiting"><span />{pixWaiting ? t("paymentWaiting") : t("paymentFailed")}</div>
                {pix.qrCodeBase64 && <div className="pix-qr"><img src={pix.qrCodeBase64} alt={t("scanQrCode")} width={220} height={220} /><span>{t("scanQrCode")}</span></div>}
                {pix.copyPaste && <div className="copy-box"><label>{t("pixCopyPaste")}</label><code>{pix.copyPaste}</code><button onClick={() => copy("pix", pix.copyPaste!)}>{copied === "pix" ? <Check size={14} /> : <Copy size={14} />}{copied === "pix" ? t("copied") : t("copyCode")}</button></div>}
                {!pix.qrCodeBase64 && pix.qrcodeUrl && <a className="donation-secondary" href={pix.qrcodeUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />{t("openPaymentPage")}</a>}
                <button className="donation-link" onClick={() => setPix(null)}>{t("changeAmount")}</button>
              </>}
            </div>}
          </div>
        ) : (
          <div className="donation-pane">
            <p className="donation-note">{t("cryptoSupportNotice")}</p>
            {cryptoError && <div className="donation-error donation-error-actions" role="alert"><span>{cryptoError}</span><button type="button" onClick={() => void loadCryptoOptions(true)} disabled={cryptoBusy}>{cryptoBusy ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}{t("tryAgain")}</button></div>}
            {!optionsLoaded && !cryptoError && <button className="donation-primary" type="button" onClick={() => void loadCryptoOptions(false)} disabled={cryptoBusy}>{cryptoBusy ? <LoaderCircle className="spin" size={16} /> : <Wallet size={16} />}{t("donateCrypto")}</button>}
            {optionsLoaded && !cryptoAddress && <>
              <div className="crypto-grid">
                <label className="donation-field"><span>{t("cryptocurrency")}</span><select value={coin} onChange={(event) => chooseCoin(event.target.value)} disabled={cryptoBusy || !coins.length}><option value="">{cryptoBusy ? t("loading") : t("selectCoin")}</option>{coins.map((item) => <option key={item.coin} value={item.coin}>{item.coin} — {item.name}</option>)}</select></label>
                <label className="donation-field"><span>{t("network")}</span><select value={network} onChange={(event) => chooseNetwork(event.target.value)} disabled={cryptoBusy || !selectedCoin}><option value="">{t("selectNetwork")}</option>{selectedCoin?.networks.map((item) => <option key={item.network} value={item.network}>{item.name} ({item.network})</option>)}</select></label>
              </div>
              {selectedNetwork?.requiresAmount && <label className="donation-field"><span>{t("donationAmount")} ({coin})</span><input className="plain-input" inputMode="decimal" value={cryptoAmount} onChange={(event) => setCryptoAmount(event.target.value.replace(/[^0-9.,]/g, ""))} placeholder="0.001" /></label>}
              {selectedNetwork && <div className="network-warning"><strong>{t("network")}: {selectedNetwork.name} ({selectedNetwork.network})</strong><span>{t("networkWarning")}</span>{selectedNetwork.specialTips && <small>{selectedNetwork.specialTips}</small>}</div>}
              <button className="donation-primary" onClick={generateCrypto} disabled={cryptoBusy || !coin || !network}>{cryptoBusy ? <LoaderCircle className="spin" size={16} /> : <Wallet size={16} />}{t("generateCryptoAddress")}</button>
            </>}

            {cryptoAddress && <div className="payment-result">
              {cryptoStatus === "CONFIRMED" ? <div className="donation-success"><Check size={24} /><strong>{t("paymentConfirmed")}</strong><p>{t("donationThanks")}</p></div> : <>
                <div className="network-warning important"><strong>{t("network")}: {cryptoAddress.networkName} ({cryptoAddress.network})</strong><span>{t("networkWarning")}</span></div>
                <div className="crypto-qr"><img src={`/api/donations/crypto/qr?value=${encodeURIComponent(cryptoAddress.address)}`} alt={t("scanQrCode")} width={190} height={190} loading="lazy" /><span>{t("scanQrCode")}</span></div>
                <div className="copy-box"><label>{t("cryptoAddress")}</label><code>{cryptoAddress.address}</code><button onClick={() => copy("address", cryptoAddress.address)}>{copied === "address" ? <Check size={14} /> : <Copy size={14} />}{copied === "address" ? t("copied") : t("copyAddress")}</button></div>
                {cryptoAddress.tag && <div className="copy-box"><label>{t("memoTag")}</label><code>{cryptoAddress.tag}</code><button onClick={() => copy("tag", cryptoAddress.tag!)}>{copied === "tag" ? <Check size={14} /> : <Copy size={14} />}{copied === "tag" ? t("copied") : t("copyCode")}</button></div>}
                <p className="donation-note">{t("cryptoTxHelp")}</p>
                <label className="donation-field"><span>{t("transactionId")}</span><input className="plain-input" value={txId} onChange={(event) => setTxId(event.target.value.slice(0, 200))} placeholder={t("transactionIdPlaceholder")} /></label>
                {cryptoStatus && <div className={`payment-status ${cryptoStatus === "FAILED" ? "failed" : "waiting"}`}><span />{cryptoStatus === "FAILED" ? t("paymentFailed") : cryptoStatus === "PENDING" ? t("paymentPendingConfirmations") : t("paymentWaiting")}</div>}
                <button className="donation-secondary" onClick={verifyCrypto} disabled={cryptoBusy || txId.trim().length < 6}>{cryptoBusy ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}{t("verifyPayment")}</button>
                {cryptoAddress.explorerUrl && <a className="donation-link" href={cryptoAddress.explorerUrl} target="_blank" rel="noreferrer"><ExternalLink size={13} />{t("openExplorer")}</a>}
                <button className="donation-link" onClick={() => { setCryptoAddress(null); setCryptoStatus(""); setTxId(""); }}>{t("changeCrypto")}</button>
              </>}
            </div>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
