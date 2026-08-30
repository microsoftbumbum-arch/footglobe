"use client";

import { useCallback, useEffect, useState } from "react";
import { TeamMark } from "./TeamMark";
export { TeamMark } from "./TeamMark";
import { RotateCcw, Tv } from "lucide-react";
import type { FootballMatch, MatchStatus } from "@/types/football";
import { useI18n } from "@/i18n/I18nProvider";

const statusKeys: Record<MatchStatus, string> = {
  SCHEDULED: "scheduled",
  LIVE: "live",
  HALFTIME: "halftime",
  FINISHED: "finished",
  POSTPONED: "postponed",
  CANCELLED: "cancelled",
  SUSPENDED: "suspended",
  UNKNOWN: "unknown",
};

type Broadcast = { id: string; name: string; country?: string; logo?: string };

export function WatchInfo({ match, compact = false }: { match: FootballMatch; compact?: boolean }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [channels, setChannels] = useState<Broadcast[]>([]);
  const [matched, setMatched] = useState(false);

  useEffect(() => {
    setState("idle");
    setChannels([]);
    setMatched(false);
  }, [match.id]);

  const load = useCallback(async () => {
    if (state === "loading") return;
    setState("loading");
    try {
      const date = new Date(match.kickoff).toISOString().slice(0, 10);
      const query = new URLSearchParams({ fixture: match.id, home: match.homeTeam.name, away: match.awayTeam.name, date });
      const response = await fetch(`/api/watch?${query.toString()}`);
      if (!response.ok) throw new Error("watch_unavailable");
      const result = await response.json() as { channels?: Broadcast[]; matched?: boolean };
      setChannels(result.channels ?? []);
      setMatched(Boolean(result.matched));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [match, state]);

  return (
    <div className={`watch-info ${compact ? "is-compact" : ""}`}>
      {state === "idle" && <button className="watch-trigger" onClick={load}><Tv size={13} />{t("whereToWatch")}</button>}
      {state === "loading" && <span className="watch-loading"><span className="watch-spinner" />{t("broadcastLoading")}</span>}
      {state === "error" && <div className="watch-error"><span>{t("broadcastUnavailable")}</span><button onClick={load}><RotateCcw size={12} />{t("tryAgain")}</button></div>}
      {state === "ready" && channels.length > 0 && <div className="watch-result">
        <span className="watch-title"><Tv size={13} />{t("whereToWatch")}</span>
        <div className="watch-channels">{channels.map((channel) => <span className="watch-channel" key={`${channel.id}-${channel.country ?? ""}`}><b>{channel.name}</b>{channel.country && <small>{channel.country}</small>}</span>)}</div>
        <small className="watch-note">{t("broadcastRegionNote")}</small>
      </div>}
      {state === "ready" && channels.length === 0 && <div className="watch-empty"><Tv size={13} /><span>{matched ? t("broadcastNotListed") : t("broadcastNoMatch")}</span><button onClick={load}><RotateCcw size={12} />{t("tryAgain")}</button></div>}
    </div>
  );
}

export function MatchCard({ match, onOpen }: { match: FootballMatch; onOpen: (match: FootballMatch) => void }) {
  const { locale, timeZone, t } = useI18n();
  const active = match.status === "LIVE" || match.status === "HALFTIME";
  const scheduled = match.status === "SCHEDULED";
  const statusLabel = t(statusKeys[match.status]);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(match.kickoff));
  const phase = scheduled
    ? time
    : match.status === "LIVE" && match.minute
      ? `${match.minute}'`
      : statusLabel;

  return (
    <article className="match-card-shell">
      <button className={`match-card ${active ? "is-live" : `is-${match.status.toLowerCase()}`}`} onClick={() => onOpen(match)} aria-label={`${match.homeTeam.name} ${t("against")} ${match.awayTeam.name}. ${statusLabel}`}>
        <span className={`match-state ${active ? "is-live" : `is-${match.status.toLowerCase()}`}`}>
          {active && <span className="live-dot" />}
          <strong>{phase}</strong>
          {match.status === "LIVE" && <small>{t("live")}</small>}
        </span>
        <span className="match-teams">
          <span className="match-team-line"><TeamMark name={match.homeTeam.name} logo={match.homeTeam.logo} /><b>{match.homeTeam.name}</b></span>
          <span className="match-team-line"><TeamMark name={match.awayTeam.name} logo={match.awayTeam.logo} /><b>{match.awayTeam.name}</b></span>
        </span>
        <span className={`match-score-column ${scheduled ? "is-scheduled" : ""}`}>
          {scheduled ? <i>×</i> : <><strong>{match.homeScore ?? "–"}</strong><strong>{match.awayScore ?? "–"}</strong></>}
        </span>
      </button>
      <WatchInfo match={match} compact />
    </article>
  );
}
