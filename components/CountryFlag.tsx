"use client";

import { useEffect, useMemo, useState } from "react";

const FLAG_CDN = "https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.5.0/flags/4x3";

export function countryFlagUrl(countryCode: string): string | null {
  const code = countryCode.trim().toLowerCase();
  return /^[a-z]{2}$/.test(code) ? `${FLAG_CDN}/${code}.svg` : null;
}

export function CountryFlag({ code, name, className = "country-flag-image" }: { code: string; name: string; className?: string }) {
  const src = useMemo(() => countryFlagUrl(code), [code]);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return <span className={`${className} country-flag-fallback`} aria-hidden="true">{code.replace(/^X-/, "").slice(0, 2)}</span>;
  }

  return <img className={className} src={src} alt="" width={28} height={21} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
