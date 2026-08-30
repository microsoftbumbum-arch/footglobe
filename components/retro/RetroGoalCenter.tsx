"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { isRetroGoal, playableRetroClip, retroEventKey, retroEventTime, retroScoreAt } from "@/lib/retro-replay";
import type { RetroEvent, RetroFixture } from "@/types/retro";
import { playRetroGoalAudio, preloadRetroGoalAudio, retryPendingRetroGoalAudio, retroGoalAudioToken, stopRetroGoalAudio, unlockRetroGoalAudio } from "./retro-goal-audio";
import { RETRO_GOAL_TEST_EVENT, type RetroGoalTestDetail } from "./retro-goal-test";
import { useRetroSoundSettings } from "./retro-sound-settings";
import { YouTubeClipPlayer } from "./YouTubeClipPlayer";

interface GoalAnnouncement {
  fixture: RetroFixture;
  event: RetroEvent;
  isTest?: boolean;
  testRegion?: string;
  testVolume?: number;
  audioAttempted?: boolean;
}

const RETRO_GOAL_ANNOUNCEMENT_DURATION_MS = 17_900;
const RETRO_GOAL_ANNOUNCEMENT_CLOSE_PADDING_MS = 700;

// Page-session scope by design: switching Hoje ⇄ Retrô does not replay an event that
// was already announced, while a full page refresh starts a new user session.
const sessionAnnouncedEventIds = new Set<string>();

function scoringTeam(fixture: RetroFixture, event: RetroEvent): string | undefined {
  if (!event.teamId) return undefined;
  if (event.teamId === fixture.homeTeam.id) return fixture.homeTeam.name;
  if (event.teamId === fixture.awayTeam.id) return fixture.awayTeam.name;
  return undefined;
}

function announcementToken(announcement: GoalAnnouncement) {
  return retroGoalAudioToken(announcement.fixture.id, announcement.event.id);
}

function RetroGoalOverlay({ announcement, audioActive, onDone, onClipStart }: { announcement: GoalAnnouncement; audioActive: boolean; onDone: () => void; onClipStart: () => void }) {
  const { t } = useI18n();
  const { fixture, event } = announcement;
  const clip = playableRetroClip(event.clip) ? event.clip : null;
  const [showClip, setShowClip] = useState(false);
  const [clipRevealed, setClipRevealed] = useState(false);
  const [clipEnded, setClipEnded] = useState(false);
  const team = scoringTeam(fixture, event);
  const explicitScore = typeof event.homeScoreAfter === "number" && typeof event.awayScoreAfter === "number";
  const canInferNormalGoal = event.type !== "own_goal" && Boolean(event.teamId && (event.teamId === fixture.homeTeam.id || event.teamId === fixture.awayTeam.id));
  const hasScore = explicitScore || canInferNormalGoal;
  const reachedAt = retroEventTime(event) ?? Date.now();
  const score = retroScoreAt(fixture, reachedAt);
  const minute = typeof event.minute === "number" ? `${event.minute}'` : "";

  useEffect(() => {
    setShowClip(false);
    setClipRevealed(false);
    setClipEnded(false);
    // When sound is enabled, keep the card visible long enough for the bundled
    // announcement to finish. This also gives a blocked browser playback a chance
    // to retry after the next user gesture.
    const revealDelay = audioActive ? RETRO_GOAL_ANNOUNCEMENT_DURATION_MS + 150 : 2_200;
    const reveal = event.featured && clip ? window.setTimeout(() => {
      setClipRevealed(true);
      setShowClip(true);
      onClipStart();
    }, revealDelay) : undefined;
    const clipLength = clip?.endSeconds && clip.startSeconds !== undefined ? Math.max(0, clip.endSeconds - clip.startSeconds) : 0;
    const audioWindow = audioActive ? RETRO_GOAL_ANNOUNCEMENT_DURATION_MS + RETRO_GOAL_ANNOUNCEMENT_CLOSE_PADDING_MS : 4_500;
    const featuredMinimum = audioActive ? audioWindow : 8_000;
    const duration = event.featured
      ? Math.min(audioActive ? 40_000 : 25_000, Math.max(featuredMinimum, clipLength ? revealDelay + clipLength * 1_000 + 5_500 : featuredMinimum))
      : audioWindow;
    const done = window.setTimeout(onDone, duration);
    return () => {
      if (reveal) window.clearTimeout(reveal);
      window.clearTimeout(done);
    };
  }, [announcement.event.id, audioActive, clip, event.featured, onClipStart, onDone]);

  return (
    <div className={`retro-goal-overlay ${event.featured ? "is-featured" : "is-standard"} ${showClip ? "showing-clip" : ""} ${announcement.isTest ? "is-test" : ""}`} role="status" aria-live="assertive">
      <button type="button" className="retro-goal-close" onClick={onDone} aria-label={t("close")}><X size={15} /></button>
      <div className="retro-goal-copy">
        <span className="retro-goal-kicker">{announcement.isTest ? `TEST • ${announcement.testRegion ?? "RETRO"}` : event.featured ? t("retroHistoricalGoal") : t("retroGoal")}</span>
        <strong>{event.featured ? t("retroFeaturedGoal") : t("retroGoal")}</strong>
        {team && <b>{team}</b>}
        <p>{event.playerName || event.headline || t("retroUnknownPlayer")}{minute ? ` • ${minute}` : ""}</p>
        {hasScore && <div className="retro-goal-scoreline"><span>{fixture.homeTeam.name}</span><em>{score.home} – {score.away}</em><span>{fixture.awayTeam.name}</span></div>}
      </div>
      {clipRevealed && clip && !showClip && <div className="retro-goal-reopen"><button type="button" onClick={() => { setClipEnded(false); setShowClip(true); onClipStart(); }}>{t("retroViewClip")}</button></div>}
      {showClip && clip && <div className="retro-goal-clip">
        <YouTubeClipPlayer clip={clip} autoPlay onClose={() => { setShowClip(false); setClipEnded(false); }} onEnded={() => setClipEnded(true)} />
        {clipEnded && <small>{t("retroClipFinished")}</small>}
      </div>}
    </div>
  );
}

export function RetroGoalCenter({ fixtures, ready, syncAt }: { fixtures: RetroFixture[]; ready: boolean; syncAt?: string }) {
  const { enabled, volume } = useRetroSoundSettings();
  const fixturesRef = useRef(fixtures);
  const baselineRef = useRef<number | null>(null);
  const currentRef = useRef<GoalAnnouncement | null>(null);
  const queueRef = useRef<GoalAnnouncement[]>([]);
  const [queue, setQueue] = useState<GoalAnnouncement[]>([]);
  const [current, setCurrent] = useState<GoalAnnouncement | null>(null);

  useEffect(() => { fixturesRef.current = fixtures; }, [fixtures]);
  useEffect(() => { currentRef.current = current; }, [current]);
  useEffect(() => { queueRef.current = queue; }, [queue]);

  useEffect(() => {
    preloadRetroGoalAudio();
    // Do not rely on browser activation-state flags as the only gate. Some browsers
    // report them inconsistently. A real goal always attempts playback; if the
    // browser blocks it, this listener retries the pending goal on the next gesture.
    const unlockAndRetry = () => {
      unlockRetroGoalAudio();
      retryPendingRetroGoalAudio();
    };
    // click/touchend are intentionally included because browser autoplay docs
    // recommend resuming Web Audio from a concrete user activation event.
    window.addEventListener("click", unlockAndRetry, { capture: true });
    window.addEventListener("pointerup", unlockAndRetry, { capture: true });
    window.addEventListener("touchend", unlockAndRetry, { capture: true, passive: true });
    window.addEventListener("keydown", unlockAndRetry, { capture: true });
    return () => {
      window.removeEventListener("click", unlockAndRetry, { capture: true });
      window.removeEventListener("pointerup", unlockAndRetry, { capture: true });
      window.removeEventListener("touchend", unlockAndRetry, { capture: true });
      window.removeEventListener("keydown", unlockAndRetry, { capture: true });
      stopRetroGoalAudio();
    };
  }, []);

  useEffect(() => {
    const handleTest = (rawEvent: Event) => {
      const detail = (rawEvent as CustomEvent<RetroGoalTestDetail>).detail;
      if (!detail?.fixture || !detail?.event) return;
      const announcement: GoalAnnouncement = {
        fixture: detail.fixture,
        event: detail.event,
        isTest: true,
        testRegion: detail.region,
        testVolume: detail.volume,
        audioAttempted: Boolean(detail.audioAlreadyStarted),
      };

      setQueue((existing) => [...existing, announcement]);
    };
    window.addEventListener(RETRO_GOAL_TEST_EVENT, handleTest as EventListener);
    return () => window.removeEventListener(RETRO_GOAL_TEST_EVENT, handleTest as EventListener);
  }, []);

  useEffect(() => {
    if (!ready || baselineRef.current !== null) return;
    const parsed = syncAt ? Date.parse(syncAt) : NaN;
    baselineRef.current = Number.isFinite(parsed) ? parsed : Date.now();
    // Do not announce events that were already in the past when this Retro entry synchronized.
    for (const fixture of fixturesRef.current) {
      for (const event of fixture.retroEvents) {
        const at = retroEventTime(event);
        if (isRetroGoal(event) && at !== null && at <= baselineRef.current) sessionAnnouncedEventIds.add(retroEventKey(fixture.id, event));
      }
    }
  }, [ready, syncAt]);

  useEffect(() => {
    if (!ready) return;
    const scan = () => {
      const baseline = baselineRef.current;
      if (baseline === null) return;
      const now = Date.now();
      const due: Array<GoalAnnouncement & { at: number; key: string }> = [];
      for (const fixture of fixturesRef.current) {
        for (const event of fixture.retroEvents) {
          if (!isRetroGoal(event)) continue;
          const key = retroEventKey(fixture.id, event);
          if (sessionAnnouncedEventIds.has(key)) continue;
          const at = retroEventTime(event);
          if (at === null || at <= baseline || at > now) continue;
          sessionAnnouncedEventIds.add(key);
          due.push({ fixture, event, at, key });
        }
      }
      if (due.length) {
        due.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
        setQueue((existing) => [...existing, ...due.map(({ fixture, event }) => ({ fixture, event }))]);
      }
    };
    scan();
    const timer = window.setInterval(scan, 1_000);
    return () => window.clearInterval(timer);
  }, [ready]);

  useEffect(() => {
    if (current || queue.length === 0) return;
    setCurrent(queue[0]);
    setQueue((items) => items.slice(1));
  }, [current, queue]);

  const configuredVolume = current?.isTest ? (current.testVolume ?? volume) : volume * (current?.event.sound?.volume ?? 1);
  const audioActive = Boolean(current) && (current?.isTest ? configuredVolume > 0 : enabled && configuredVolume > 0);

  useEffect(() => {
    if (!current || !audioActive || current.audioAttempted) return;
    void playRetroGoalAudio(announcementToken(current), configuredVolume);
  }, [audioActive, configuredVolume, current]);

  const onClipStart = useCallback(() => {
    const active = currentRef.current;
    if (active) stopRetroGoalAudio(announcementToken(active));
  }, []);

  const onDone = useCallback(() => {
    setCurrent((active) => {
      if (active) stopRetroGoalAudio(announcementToken(active));
      return null;
    });
  }, []);

  if (!current) return null;
  return <RetroGoalOverlay announcement={current} audioActive={audioActive} onClipStart={onClipStart} onDone={onDone} />;
}
