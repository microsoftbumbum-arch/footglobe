"use client";

import type { RetroEvent, RetroFixture } from "@/types/retro";

export const RETRO_GOAL_TEST_EVENT = "footglobe:retro-goal-test";

export type RetroGoalTestRegion = "Europe" | "Americas" | "Africa" | "Asia-Pacific";

type Scenario = {
  region: RetroGoalTestRegion;
  country: string;
  countryCode: string;
  competition: string;
  home: string;
  away: string;
  player: string;
  meme: string;
  scoringSide: "home" | "away";
  minute: number;
  homeScore: number;
  awayScore: number;
};

// Exactly 20 meme-inspired test references: 5 Europe, 5 Americas, 5 Africa and 5 Asia-Pacific.
// Clubs and scorers are fictional; the meme labels are only playful references used by the local sound-test button.
export const RETRO_GOAL_TEST_SCENARIOS: readonly Scenario[] = [
  { region: "Europe", country: "England", countryCode: "GB-ENG", competition: "Meme Test League", home: "Coming Home FC", away: "Tea & Biscuits United", player: "Barry Sixty-Three", meme: "It's Coming Home", scoringSide: "home", minute: 63, homeScore: 2, awayScore: 1 },
  { region: "Europe", country: "Spain", countryCode: "ES", competition: "Meme Test League", home: "KEKW Sevilla", away: "Jajaja Athletic", player: "Juan Jajaja", meme: "KEKW / El Risitas", scoringSide: "away", minute: 28, homeScore: 1, awayScore: 2 },
  { region: "Europe", country: "Germany", countryCode: "DE", competition: "Meme Test League", home: "Techno Viking FC", away: "Autobahn 08", player: "Hans Rave", meme: "Techno Viking", scoringSide: "home", minute: 44, homeScore: 2, awayScore: 0 },
  { region: "Europe", country: "France", countryCode: "FR", competition: "Meme Test League", home: "Baguette FC", away: "Hon Hon United", player: "Pierre Honhon", meme: "Hon Hon Baguette", scoringSide: "home", minute: 57, homeScore: 3, awayScore: 2 },
  { region: "Europe", country: "Italy", countryCode: "IT", competition: "Meme Test League", home: "Mamma Mia Calcio", away: "Pasta La Vista", player: "Gino Gestore", meme: "Italian Hand Gesture", scoringSide: "away", minute: 81, homeScore: 2, awayScore: 3 },

  { region: "Americas", country: "Brazil", countryCode: "BR", competition: "Meme Test Cup", home: "Receba FC", away: "Calma Calabreso", player: "Pedrinho Receba", meme: "RECEBA!", scoringSide: "home", minute: 22, homeScore: 1, awayScore: 0 },
  { region: "Americas", country: "Brazil", countryCode: "BR", competition: "Meme Test Cup", home: "Bora Bill FC", away: "Caneta Azul 08", player: "Billson Silva", meme: "Bora Bill", scoringSide: "away", minute: 37, homeScore: 1, awayScore: 2 },
  { region: "Americas", country: "Argentina", countryCode: "AR", competition: "Meme Test Cup", home: "Que Miras Bobo FC", away: "Muchachos United", player: "Nico Bobo", meme: "¿Qué mirás, bobo?", scoringSide: "home", minute: 52, homeScore: 2, awayScore: 1 },
  { region: "Americas", country: "Mexico", countryCode: "MX", competition: "Meme Test Cup", home: "No Era Penal FC", away: "VARcito Athletic", player: "Memo Memez", meme: "No era penal", scoringSide: "away", minute: 74, homeScore: 1, awayScore: 2 },
  { region: "Americas", country: "United States", countryCode: "US", competition: "Meme Test Cup", home: "Florida Man United", away: "Ohio FC", player: "Chad Sidequest", meme: "Florida Man vs Ohio", scoringSide: "home", minute: 90, homeScore: 4, awayScore: 3 },

  { region: "Africa", country: "Ghana", countryCode: "GH", competition: "Meme Test Shield", home: "Coffin Dance FC", away: "Astronomia United", player: "Kofi Steps", meme: "Coffin Dance", scoringSide: "home", minute: 14, homeScore: 1, awayScore: 0 },
  { region: "Africa", country: "Nigeria", countryCode: "NG", competition: "Meme Test Shield", home: "Why Are You Running FC", away: "Nollywood United", player: "Chidi Sprint", meme: "Why are you running?", scoringSide: "away", minute: 29, homeScore: 0, awayScore: 1 },
  { region: "Africa", country: "South Africa", countryCode: "ZA", competition: "Meme Test Shield", home: "Vuvuzela.exe", away: "Amapiano Loading", player: "Thabo Bass", meme: "Vuvuzela.exe", scoringSide: "home", minute: 46, homeScore: 2, awayScore: 1 },
  { region: "Africa", country: "Kenya", countryCode: "KE", competition: "Meme Test Shield", home: "Hakuna Lag FC", away: "Buffering United", player: "Juma WiFi", meme: "Hakuna Lag", scoringSide: "away", minute: 66, homeScore: 1, awayScore: 2 },
  { region: "Africa", country: "Morocco", countryCode: "MA", competition: "Meme Test Shield", home: "Mint Tea Loading", away: "Atlas Sidequest", player: "Yassine Buffer", meme: "Mint Tea Loading...", scoringSide: "home", minute: 88, homeScore: 3, awayScore: 2 },

  { region: "Asia-Pacific", country: "Japan", countryCode: "JP", competition: "Meme Test Cup", home: "NANI FC", away: "Plot Armor United", player: "Kenji Nani", meme: "NANI?!", scoringSide: "away", minute: 13, homeScore: 0, awayScore: 1 },
  { region: "Asia-Pacific", country: "Indonesia", countryCode: "ID", competition: "Meme Test Cup", home: "Om Telolet Om FC", away: "Bus Horn United", player: "Arif Telolet", meme: "Om Telolet Om", scoringSide: "home", minute: 33, homeScore: 2, awayScore: 0 },
  { region: "Asia-Pacific", country: "Australia", countryCode: "AU", competition: "Meme Test Cup", home: "Yeah Nah FC", away: "Nah Yeah United", player: "Damo Mate", meme: "Yeah nah / Nah yeah", scoringSide: "away", minute: 59, homeScore: 1, awayScore: 2 },
  { region: "Asia-Pacific", country: "Malaysia", countryCode: "MY", competition: "Meme Test Cup", home: "Haiyaa FC", away: "Fuiyoh Athletic", player: "Uncle Limbo", meme: "Haiyaa / Fuiyoh", scoringSide: "home", minute: 72, homeScore: 3, awayScore: 1 },
  { region: "Asia-Pacific", country: "India", countryCode: "IN", competition: "Meme Test Cup", home: "Moye Moye FC", away: "Reel United 08", player: "Ravi Replay", meme: "Moye Moye", scoringSide: "away", minute: 87, homeScore: 2, awayScore: 3 },
] as const;

let bag: number[] = [];
let lastScenario = -1;

function refillBag() {
  bag = Array.from({ length: RETRO_GOAL_TEST_SCENARIOS.length }, (_, index) => index);
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  // Avoid repeating the final scenario from the previous 20-test cycle.
  if (bag.length > 1 && bag[bag.length - 1] === lastScenario) [bag[bag.length - 1], bag[bag.length - 2]] = [bag[bag.length - 2], bag[bag.length - 1]];
}

export interface RetroGoalTestDetail {
  fixture: RetroFixture;
  event: RetroEvent;
  region: RetroGoalTestRegion;
  volume: number;
  audioAlreadyStarted?: boolean;
}

export function createRetroGoalTestDetail(volume: number): RetroGoalTestDetail {
  if (bag.length === 0) refillBag();
  const index = bag.pop() ?? 0;
  lastScenario = index;
  const scenario = RETRO_GOAL_TEST_SCENARIOS[index];
  const stamp = Date.now();
  const homeId = `retro-test-home-${stamp}-${index}`;
  const awayId = `retro-test-away-${stamp}-${index}`;
  const eventId = `retro-test-goal-${stamp}-${index}`;
  const scoringTeamId = scenario.scoringSide === "home" ? homeId : awayId;
  const simulatedAt = new Date(stamp).toISOString();

  const event: RetroEvent = {
    id: eventId,
    type: "goal",
    minute: scenario.minute,
    second: 0,
    playerName: scenario.player,
    teamId: scoringTeamId,
    homeScoreAfter: scenario.homeScore,
    awayScoreAfter: scenario.awayScore,
    featured: false,
    headline: `TEST • ${scenario.region} • ${scenario.meme}`,
    description: `Meme test: ${scenario.meme}. Fictional clubs and scorer.`,
    simulatedAt,
    sourceName: "footglobe-local-test",
    sound: null,
    clip: null,
  };

  const fixture: RetroFixture = {
    id: `retro-test-fixture-${stamp}-${index}`,
    retro: true,
    country: scenario.country,
    countryCode: scenario.countryCode,
    competition: scenario.competition,
    homeTeam: { id: homeId, name: scenario.home, shortName: scenario.home },
    awayTeam: { id: awayId, name: scenario.away, shortName: scenario.away },
    homeScore: scenario.homeScore,
    awayScore: scenario.awayScore,
    status: "LIVE",
    minute: scenario.minute,
    kickoff: new Date(stamp - scenario.minute * 60_000).toISOString(),
    isLive: true,
    historicalDate: "2008-08-30",
    historicalKickoff: "20:00:00",
    kickoffPrecision: "simulated",
    finalHomeScore: null,
    finalAwayScore: null,
    simulation: {
      status: "live",
      simulatedKickoff: new Date(stamp - scenario.minute * 60_000).toISOString(),
      elapsedMatchSeconds: scenario.minute * 60,
      elapsedMatchMinute: scenario.minute,
      snapshotAt: simulatedAt,
    },
    retroEvents: [event],
  };

  return { fixture, event, region: scenario.region, volume: Math.max(0, Math.min(1, volume)) };
}
