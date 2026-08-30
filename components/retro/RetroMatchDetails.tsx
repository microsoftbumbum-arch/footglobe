"use client";

import { useEffect, useMemo, useState } from "react";
import { Film, RotateCcw, Shirt } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RetroTeamMark } from "./RetroTeamMark";
import { useI18n } from "@/i18n/I18nProvider";
import { playableRetroClip, retroElapsedMinute, retroScoreAt, visibleRetroEvents } from "@/lib/retro-replay";
import type { RetroEvent, RetroFixture, RetroFixtureResponse } from "@/types/retro";
import { YouTubeClipPlayer } from "./YouTubeClipPlayer";

const statusKeys = {
  scheduled: "scheduled",
  live: "live",
  halftime: "halftime",
  finished: "finished",
  date_only: "retroStatusDateOnly",
} as const;

function HistoricalKit({ url, team }: { url?: string; team: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (!url || failed) return null;
  return <img className="retro-kit-image" src={url} alt="" title={team} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

function eventLabel(event: RetroEvent, fallback: string) {
  return event.headline || event.description || event.playerName || fallback;
}

export function RetroMatchDetails({ match, onClose }: { match: RetroFixture | null; onClose: () => void }) {
  const { locale, timeZone, t } = useI18n();
  const [detail, setDetail] = useState<RetroFixture | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [now, setNow] = useState(() => Date.now());
  const [clipEvent, setClipEvent] = useState<RetroEvent | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setDetail(null);
    setClipEvent(null);
    if (!match) { setState("idle"); return; }
    const controller = new AbortController();
    setState("loading");
    fetch(`/api/retro/fixtures/${encodeURIComponent(match.id)}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("retro_fixture_unavailable");
        return response.json() as Promise<RetroFixtureResponse>;
      })
      .then((result) => { setDetail(result.fixture); setState("ready"); })
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        setState("error");
      });
    return () => controller.abort();
  }, [match?.id, retryKey]);

  const fixture = detail ?? match;
  const ticking = fixture?.simulation.status === "live" || fixture?.simulation.status === "halftime";
  useEffect(() => {
    setNow(Date.now());
    if (!ticking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [fixture?.id, fixture?.simulation.snapshotAt, ticking]);

  const visibleEvents = useMemo(() => fixture ? visibleRetroEvents(fixture, now) : [], [fixture, now]);
  const score = fixture ? retroScoreAt(fixture, now) : { home: 0, away: 0 };
  const elapsedMinute = fixture ? retroElapsedMinute(fixture.simulation, now) : null;
  const statsBomb = visibleEvents.some((event) => event.sourceName?.toLowerCase() === "statsbomb-open");

  if (!match || !fixture) return null;
  const historicalDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${fixture.historicalDate}T12:00:00Z`));
  const status = t(statusKeys[fixture.simulation.status]);
  const historicalTimeSource = fixture.historicalKickoff ? new Date(fixture.historicalKickoff) : null;
  const replayTimeSource = fixture.simulation.simulatedKickoff ? new Date(fixture.simulation.simulatedKickoff) : null;
  const timeSource = fixture.kickoffPrecision === "simulated" ? replayTimeSource : historicalTimeSource;
  const timeLabel = timeSource && !Number.isNaN(timeSource.getTime())
    ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(timeSource)
    : null;
  const active = fixture.simulation.status === "live" || fixture.simulation.status === "halftime";

  return (
    <Dialog open={Boolean(match)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="match-dialog retro-match-dialog" closeLabel={t("close")}>
        <DialogHeader className="detail-header">
          <DialogDescription>{t("retroModeFull")} · {historicalDate} · {fixture.competition}</DialogDescription>
          <DialogTitle className="detail-title">{t("matchDetails")}</DialogTitle>
        </DialogHeader>

        <div className="detail-score retro-detail-score">
          <div className="detail-team detail-team-home"><RetroTeamMark team={fixture.homeTeam} /><b>{fixture.homeTeam.name}</b></div>
          <div className="detail-score-center">
            <strong>{score.home}<em>:</em>{score.away}</strong>
            <span className={`detail-status ${active ? "is-live" : ""}`}>{active && <span className="live-dot" />}{status}{active && elapsedMinute !== null && <span className="retro-detail-clock"> · {elapsedMinute}&apos;</span>}</span>
          </div>
          <div className="detail-team detail-team-away"><RetroTeamMark team={fixture.awayTeam} /><b>{fixture.awayTeam.name}</b></div>
        </div>

        <dl className="detail-facts retro-detail-facts">
          <div><dt>{t("retroHistoricalDate")}</dt><dd>{historicalDate}</dd></div>
          <div title={fixture.kickoffPrecision === "simulated" ? t("retroReplayTimeHelp") : undefined}><dt>{fixture.kickoffPrecision === "simulated" ? t("retroReplayTime") : fixture.kickoffPrecision === "time" ? t("retroHistoricalTime") : t("retroStatusDateOnly")}</dt><dd>{timeLabel ?? t("retroStatusDateOnly")}</dd></div>
          <div><dt>{t("stadium")}</dt><dd>{fixture.stadium || t("notProvided")}</dd></div>
        </dl>

        {(fixture.homeTeam.kitUrl || fixture.awayTeam.kitUrl) && <section className="retro-kits-section">
          <h3><Shirt size={13} />{t("retroTeamKit")}</h3>
          <div><HistoricalKit url={fixture.homeTeam.kitUrl} team={fixture.homeTeam.name} /><HistoricalKit url={fixture.awayTeam.kitUrl} team={fixture.awayTeam.name} /></div>
        </section>}

        {state === "loading" && <p className="muted-copy retro-detail-loading">{t("loading")}</p>}
        {state === "error" && <div className="watch-error"><span>{t("retroDetailsUnavailable")}</span><button type="button" onClick={() => { setDetail(null); setRetryKey((value) => value + 1); }}><RotateCcw size={12} />{t("tryAgain")}</button></div>}

        <section className="events-section retro-events-section">
          <h3>{t("matchEvents")}</h3>
          <div className="retro-event-list">
            {visibleEvents.length ? visibleEvents.map((event) => {
              const clip = playableRetroClip(event.clip) ? event.clip : null;
              return <div className={`retro-event-row ${event.featured ? "is-featured" : ""}`} key={event.id}>
                <span className="retro-event-minute">{typeof event.minute === "number" ? `${event.minute}'` : "•"}</span>
                <div><b>{eventLabel(event, t("retroEvent"))}</b>{event.assistName && <small>{t("retroAssist", { player: event.assistName })}</small>}</div>
                {clip && <button type="button" onClick={() => setClipEvent(event)}><Film size={12} />{t("retroViewClip")}</button>}
              </div>;
            }) : <p className="muted-copy">{t("retroEventsWaiting")}</p>}
          </div>
          {statsBomb && <p className="retro-attribution">{t("retroStatsBombAttribution")}</p>}
        </section>

        {clipEvent && playableRetroClip(clipEvent.clip) && <section className="retro-detail-clip">
          <h3>{clipEvent.featured ? t("retroHistoricalGoal") : t("retroViewClip")}</h3>
          <YouTubeClipPlayer clip={clipEvent.clip} autoPlay={false} onClose={() => setClipEvent(null)} />
        </section>}
      </DialogContent>
    </Dialog>
  );
}
