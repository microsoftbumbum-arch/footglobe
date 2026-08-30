"use client";

import { useCallback, useEffect, useState } from "react";
import { Clapperboard, ExternalLink, RotateCcw, Tv } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/I18nProvider";
import { TeamMark, WatchInfo } from "./MatchCard";
import type { FootballMatch } from "@/types/football";

const statusKeys = { SCHEDULED: "scheduled", LIVE: "live", HALFTIME: "halftime", FINISHED: "finished", POSTPONED: "postponed", CANCELLED: "cancelled", SUSPENDED: "suspended", UNKNOWN: "unknown" } as const;

type HighlightPayload = { found?: boolean; title?: string; competition?: string; thumbnail?: string; url?: string; embedUrl?: string; videoId?: string; channelTitle?: string; publishedAt?: string; videoCount?: number; source?: "youtube" };

function HighlightsInfo({ match }: { match: FootballMatch }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [item, setItem] = useState<HighlightPayload | null>(null);

  useEffect(() => { setState("idle"); setItem(null); }, [match.id]);

  const load = useCallback(async (force = false) => {
    if (state === "loading") return;
    setState("loading");
    try {
      const query = new URLSearchParams({ home: match.homeTeam.name, away: match.awayTeam.name, kickoff: match.kickoff, competition: match.competition });
      if (force) query.set("retry", "1");
      const response = await fetch(`/api/highlights?${query.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("highlights_unavailable");
      const result = await response.json() as HighlightPayload;
      setItem(result);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [match.awayTeam.name, match.competition, match.homeTeam.name, match.kickoff, state]);

  return (
    <section className="highlights-section">
      <div className="highlights-heading"><Clapperboard size={14} /><h3>{t("highlights")}</h3></div>
      {state === "idle" && <button className="highlights-trigger" onClick={() => void load(false)}><Clapperboard size={13} />{t("findHighlights")}</button>}
      {state === "loading" && <span className="watch-loading"><span className="watch-spinner" />{t("highlightsLoading")}</span>}
      {state === "error" && <div className="watch-error"><span>{t("highlightsUnavailable")}</span><button onClick={() => void load(true)}><RotateCcw size={12} />{t("tryAgain")}</button></div>}
      {state === "ready" && !item?.found && <div className="watch-empty"><Clapperboard size={13} /><span>{t("highlightsNotFound")}</span></div>}
      {state === "ready" && item?.found && item.url && <div className="youtube-highlight-card">
        {item.embedUrl && <div className="youtube-highlight-player"><iframe src={item.embedUrl} title={item.title || t("highlights")} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>}
        <div className="youtube-highlight-meta">
          <span><b>{item.title || `${match.homeTeam.name} × ${match.awayTeam.name}`}</b><small>{item.channelTitle || t("highlightsAvailable")}</small></span>
          <a href={item.url} target="_blank" rel="noopener noreferrer">YouTube <ExternalLink size={12} /></a>
        </div>
      </div>}
    </section>
  );
}

export function MatchDetails({ match, onClose }: { match: FootballMatch | null; onClose: () => void }) {
  const { locale, timeZone, t } = useI18n();
  if (!match) return null;
  const active = match.isLive;
  let country = match.country;
  try { country = new Intl.DisplayNames([locale], { type: "region" }).of(match.countryCode) ?? country; } catch { /* use the official API name */ }

  const kickoff = new Date(match.kickoff);
  const kickoffDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone }).format(kickoff);
  const kickoffTime = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(kickoff);
  const status = active ? `${t("live")}${match.minute ? ` · ${match.minute}'` : ""}` : t(statusKeys[match.status]);

  return (
    <Dialog open={Boolean(match)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="match-dialog" closeLabel={t("close")}>
        <DialogHeader className="detail-header">
          <DialogDescription>{country} · {match.competition}</DialogDescription>
          <DialogTitle className="detail-title">{t("matchDetails")}</DialogTitle>
        </DialogHeader>

        <div className="detail-score">
          <div className="detail-team detail-team-home"><TeamMark name={match.homeTeam.name} logo={match.homeTeam.logo} /><b>{match.homeTeam.name}</b></div>
          <div className="detail-score-center">
            <strong>{match.homeScore ?? "–"}<em>:</em>{match.awayScore ?? "–"}</strong>
            <span className={`detail-status ${active ? "is-live" : ""}`}>{active && <span className="live-dot" />}{status}</span>
          </div>
          <div className="detail-team detail-team-away"><TeamMark name={match.awayTeam.name} logo={match.awayTeam.logo} /><b>{match.awayTeam.name}</b></div>
        </div>

        <dl className="detail-facts">
          <div><dt>{t("start")}</dt><dd>{kickoffDate} · {kickoffTime}</dd></div>
          <div><dt>{t("stadium")}</dt><dd>{match.stadium || t("notProvided")}</dd></div>
          {match.city && <div><dt>{t("city")}</dt><dd>{match.city}</dd></div>}
        </dl>

        <WatchInfo match={match} />
        {match.status === "FINISHED" && <HighlightsInfo match={match} />}

        <section className="events-section">
          <h3>{t("matchEvents")}</h3>
          <div className="event-list">
            {match.events?.length ? match.events.map((event) => <div className="event-row" key={`${event.minute}-${event.text ?? event.i18nKey ?? event.type}`}><b>{event.minute}&apos;</b><span>{event.i18nKey ? t(event.i18nKey, event.values) : event.text}</span></div>) : <p className="muted-copy">{t("noEvents")}</p>}
          </div>
        </section>

        <div className="future-data" aria-label={t("futureFeatures")}>
          <span>{t("standings")}</span><span>{t("recentMatches")}</span><span>{t("statistics")}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
