"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { RetroTeamMark } from "./RetroTeamMark";
import { retroElapsedMinute, retroScoreAt } from "@/lib/retro-replay";
import type { RetroFixture } from "@/types/retro";

const statusKeys = {
  scheduled: "scheduled",
  live: "live",
  halftime: "halftime",
  finished: "finished",
  date_only: "retroStatusDateOnly",
} as const;

function kickoffLabel(fixture: RetroFixture, locale: string, timeZone: string, t: (key: string) => string) {
  if (fixture.kickoffPrecision === "date") return t("retroStatusDateOnly");
  const source = fixture.simulation.simulatedKickoff || fixture.historicalKickoff || fixture.kickoff;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return t("retroStatusDateOnly");
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(date);
}

export function RetroMatchCard({ fixture, onOpen }: { fixture: RetroFixture; onOpen: (fixture: RetroFixture) => void }) {
  const { locale, timeZone, t } = useI18n();
  const active = fixture.simulation.status === "live" || fixture.simulation.status === "halftime";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [active, fixture.id, fixture.simulation.snapshotAt]);

  const label = t(statusKeys[fixture.simulation.status]);
  const kickoff = kickoffLabel(fixture, locale, timeZone, t);
  const score = retroScoreAt(fixture, now);
  const minute = retroElapsedMinute(fixture.simulation, now);
  const scheduled = fixture.simulation.status === "scheduled" || fixture.simulation.status === "date_only";
  const phase = scheduled
    ? kickoff
    : fixture.simulation.status === "live" && minute !== null
      ? `${minute}'`
      : label;

  return (
    <article className="retro-match-card-shell">
      <button className={`match-card retro-match-card ${active ? "is-live" : `is-${fixture.simulation.status}`}`} onClick={() => onOpen(fixture)} aria-label={`${fixture.homeTeam.name} ${t("against")} ${fixture.awayTeam.name}. ${label}`}>
        <span className={`match-state ${active ? "is-live" : `is-${fixture.simulation.status}`}`}>
          {active && <span className="live-dot" />}
          <strong>{phase}</strong>
          {fixture.simulation.status === "live" && <small>{t("live")}</small>}
        </span>
        <span className="match-teams">
          <span className="match-team-line"><RetroTeamMark team={fixture.homeTeam} /><b>{fixture.homeTeam.name}</b></span>
          <span className="match-team-line"><RetroTeamMark team={fixture.awayTeam} /><b>{fixture.awayTeam.name}</b></span>
        </span>
        <span className={`match-score-column ${scheduled ? "is-scheduled" : ""}`}>
          {scheduled ? <i>×</i> : <><strong className="retro-row-score home">{score.home}</strong><strong className="retro-row-score away">{score.away}</strong></>}
        </span>
        {fixture.kickoffPrecision === "simulated" && <span className="retro-precision-note" title={t("retroReplayTimeHelp")}>{t("retroReplayTime")}</span>}
      </button>
    </article>
  );
}
