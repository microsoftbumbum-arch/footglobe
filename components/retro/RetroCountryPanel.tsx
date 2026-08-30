"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CountryFlag } from "@/components/CountryFlag";
import { useI18n } from "@/i18n/I18nProvider";
import { RetroMatchCard } from "./RetroMatchCard";
import type { CountryMatches } from "@/types/football";
import type { RetroFixture } from "@/types/retro";

function CompetitionLogo({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return null;
  return <img src={src} alt="" width={18} height={18} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

function coordinate(value: number, positive: string, negative: string) {
  const side = value >= 0 ? positive : negative;
  return `${Math.abs(value).toFixed(2)}° ${side}`;
}

function useDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return desktop;
}

export function RetroCountryPanel({ country, onClose, onMatchOpen }: { country: CountryMatches | null; onClose: () => void; onMatchOpen: (match: RetroFixture) => void }) {
  const { direction, plural, t } = useI18n();
  const desktop = useDesktop();
  const groups = useMemo(() => {
    const result: Record<string, RetroFixture[]> = {};
    for (const match of country?.matches ?? []) {
      const retro = match as RetroFixture;
      result[retro.competition] = [...(result[retro.competition] ?? []), retro];
    }
    return result;
  }, [country]);

  return (
    <Sheet open={Boolean(country)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side={desktop ? direction === "rtl" ? "left" : "right" : "bottom"} className="country-sheet retro-country-sheet" overlayClassName="country-sheet-overlay" closeLabel={t("close")}>
        {country && <>
          <SheetHeader className="country-heading">
            <SheetDescription className="eyebrow">{t("retroPanelEyebrow")}</SheetDescription>
            <SheetTitle><CountryFlag code={country.countryCode} name={country.country} className="country-heading-flag" /><span>{country.country}</span></SheetTitle>
            <div className="country-heading-meta">
              <span>{coordinate(country.lat, "N", "S")} · {coordinate(country.lng, "E", "W")}</span>
              <b>{plural("matchesOnDate", country.matches.length)}</b>
            </div>
          </SheetHeader>
          <div className="country-matches scrollbar-thin">
            {Object.entries(groups).map(([competition, matches]) => <section key={competition} className="competition-group">
              <h3><span className="competition-name"><CompetitionLogo src={matches[0]?.competitionLogo} />{competition}</span><b>{matches.length}</b></h3>
              {matches.map((fixture) => <RetroMatchCard key={fixture.id} fixture={fixture} onOpen={onMatchOpen} />)}
            </section>)}
          </div>
        </>}
      </SheetContent>
    </Sheet>
  );
}
