import type { FootballMatch, Team } from "@/types/football";

export type RetroSimulationStatus = "scheduled" | "live" | "halftime" | "finished" | "date_only";
export type RetroKickoffPrecision = "time" | "simulated" | "date";

export interface RetroSeason {
  id: string;
  slug: string;
  label: string;
  name?: string;
  startDate?: string;
  endDate?: string;
}

export interface RetroSound {
  key?: string;
  audioUrl: string;
  volume?: number;
}

export interface RetroClip {
  provider: string;
  videoId?: string;
  startSeconds?: number;
  endSeconds?: number;
  embeddable?: boolean;
  enabled?: boolean;
}

export interface RetroEvent {
  id: string;
  type: string;
  minute?: number;
  second?: number;
  playerName?: string;
  assistName?: string;
  teamId?: string;
  homeScoreAfter?: number | null;
  awayScoreAfter?: number | null;
  featured: boolean;
  headline?: string;
  description?: string;
  simulatedAt?: string;
  sourceName?: string;
  sound?: RetroSound | null;
  clip?: RetroClip | null;
}

export interface RetroTeam extends Team {
  kitUrl?: string;
}

export interface RetroSimulation {
  status: RetroSimulationStatus;
  simulatedKickoff?: string;
  elapsedMatchSeconds?: number;
  elapsedMatchMinute?: number;
  snapshotAt: string;
}

export interface RetroFixture extends Omit<FootballMatch, "homeTeam" | "awayTeam" | "events"> {
  retro: true;
  homeTeam: RetroTeam;
  awayTeam: RetroTeam;
  historicalDate: string;
  historicalKickoff?: string;
  kickoffPrecision: RetroKickoffPrecision;
  finalHomeScore: number | null;
  finalAwayScore: number | null;
  simulation: RetroSimulation;
  retroEvents: RetroEvent[];
}

export interface RetroDaySimulation {
  historicalDate: string;
  replayTime?: string;
  currentTime?: string;
  snapshotAt: string;
}

export interface RetroTodayResponse {
  season: RetroSeason;
  simulation: RetroDaySimulation;
  fixtures: RetroFixture[];
  fetchedAt: string;
  apiVersion?: string;
}

export interface RetroSeasonsResponse {
  seasons: RetroSeason[];
  fetchedAt: string;
}

export interface RetroFixtureResponse {
  fixture: RetroFixture;
  fetchedAt: string;
}
