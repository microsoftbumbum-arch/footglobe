import type { RetroClip, RetroEvent, RetroFixture, RetroSimulation } from "@/types/retro";

export const RETRO_GOAL_TYPES = new Set(["goal", "penalty_goal", "own_goal"]);

export function isRetroGoal(event: RetroEvent) {
  return RETRO_GOAL_TYPES.has(event.type.toLowerCase());
}

export function retroEventKey(fixtureId: string, event: RetroEvent) {
  return event.id || `${fixtureId}:${event.type}:${event.simulatedAt ?? "na"}:${event.minute ?? "na"}:${event.playerName ?? "na"}`;
}

export function retroEventTime(event: RetroEvent): number | null {
  if (!event.simulatedAt) return null;
  const value = Date.parse(event.simulatedAt);
  return Number.isFinite(value) ? value : null;
}

export function isRetroEventReached(event: RetroEvent, nowMs: number) {
  const at = retroEventTime(event);
  return at !== null && at <= nowMs;
}

export function visibleRetroEvents(fixture: RetroFixture, nowMs: number): RetroEvent[] {
  if (fixture.simulation.status === "finished") return fixture.retroEvents;
  return fixture.retroEvents.filter((event) => isRetroEventReached(event, nowMs));
}

export function retroScoreAt(fixture: RetroFixture, nowMs: number): { home: number; away: number } {
  if (fixture.simulation.status === "finished") {
    return { home: fixture.finalHomeScore ?? 0, away: fixture.finalAwayScore ?? 0 };
  }

  if (fixture.simulation.status === "scheduled" || fixture.simulation.status === "date_only") {
    return { home: 0, away: 0 };
  }

  let home = 0;
  let away = 0;
  const reached = visibleRetroEvents(fixture, nowMs)
    .filter(isRetroGoal)
    .sort((a, b) => (retroEventTime(a) ?? 0) - (retroEventTime(b) ?? 0));

  for (const event of reached) {
    const hasHomeAfter = typeof event.homeScoreAfter === "number";
    const hasAwayAfter = typeof event.awayScoreAfter === "number";
    if (hasHomeAfter) home = event.homeScoreAfter as number;
    if (hasAwayAfter) away = event.awayScoreAfter as number;

    // When the API has a real goal event but no score-after snapshot, a normal/penalty
    // goal can still be counted from its canonical teamId. Own goals are not inferred
    // because teamId semantics can vary; those wait for score-after or the final score.
    if (!hasHomeAfter && !hasAwayAfter && event.type !== "own_goal" && event.teamId) {
      if (event.teamId === fixture.homeTeam.id) home += 1;
      else if (event.teamId === fixture.awayTeam.id) away += 1;
    }
  }
  return { home, away };
}

export function retroElapsedSeconds(simulation: RetroSimulation, nowMs: number): number {
  const base = Math.max(0, simulation.elapsedMatchSeconds ?? (simulation.elapsedMatchMinute ?? 0) * 60);
  if (simulation.status !== "live") return base;
  const snapshot = Date.parse(simulation.snapshotAt);
  if (!Number.isFinite(snapshot)) return base;
  const advanced = Math.max(0, Math.floor((nowMs - snapshot) / 1000));
  return Math.min(120 * 60, base + advanced);
}

export function retroElapsedMinute(simulation: RetroSimulation, nowMs: number): number | null {
  if (simulation.status !== "live" && simulation.status !== "halftime") return null;
  return Math.max(1, Math.floor(retroElapsedSeconds(simulation, nowMs) / 60));
}

export function playableRetroClip(clip: RetroClip | null | undefined): clip is RetroClip & { videoId: string } {
  return Boolean(
    clip &&
    clip.provider.toLowerCase() === "youtube" &&
    clip.videoId &&
    clip.embeddable === true &&
    clip.enabled === true,
  );
}
