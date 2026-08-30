export type MatchStatus =
  | "SCHEDULED"
  | "LIVE"
  | "HALFTIME"
  | "FINISHED"
  | "POSTPONED"
  | "CANCELLED"
  | "SUSPENDED"
  | "UNKNOWN";

export interface Team {
  id?: string;
  slug?: string;
  name: string;
  shortName: string;
  logo?: string;
  countryId?: string;
  countryName?: string;
}

export interface MatchEvent {
  minute: number;
  type: "goal" | "card" | "substitution";
  text?: string;
  i18nKey?: string;
  values?: Record<string, string | number>;
}

export interface FootballMatch {
  id: string;
  country: string;
  countryCode: string;
  countryId?: string;
  countrySlug?: string;
  competition: string;
  competitionId?: string;
  competitionSlug?: string;
  competitionLogo?: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  minute: number | null;
  kickoff: string;
  stadium?: string;
  city?: string;
  round?: string;
  lastSyncedAt?: string;
  isLive: boolean;
  events?: MatchEvent[];
}

export interface CountryMatches {
  country: string;
  countryCode: string;
  flag: string;
  globeName: string;
  lat: number;
  lng: number;
  matches: FootballMatch[];
}

export interface MatchesResponse {
  date: string;
  source: "footglobe-api" | "unavailable";
  coverage?: "global" | "unavailable";
  matches: FootballMatch[];
  cached?: boolean;
  stale?: boolean;
  updatedAt?: string;
  error?: string;
}
