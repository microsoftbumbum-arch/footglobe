"use client";

import { useEffect, useMemo, useState } from "react";
import { TeamMark } from "@/components/matches/TeamMark";
import type { RetroTeam } from "@/types/retro";

const logoCache = new Map<string, string | null>();
const pendingLogos = new Map<string, Promise<string | null>>();

function assetKey(team: RetroTeam) {
  return `${team.slug || team.name}:${team.countryId || ""}`.toLowerCase();
}

function requestLogo(team: RetroTeam) {
  const key = assetKey(team);
  const cached = logoCache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);
  const pending = pendingLogos.get(key);
  if (pending) return pending;

  const params = new URLSearchParams({ name: team.name });
  if (team.slug) params.set("slug", team.slug);
  if (team.countryId) params.set("countryId", team.countryId);
  const promise = fetch(`/api/retro/team-assets?${params}`)
    .then((response) => response.ok ? response.json() as Promise<{ logo?: string | null }> : { logo: null })
    .then((result) => typeof result.logo === "string" && result.logo ? result.logo : null)
    .catch(() => null)
    .then((logo) => {
      logoCache.set(key, logo);
      return logo;
    })
    .finally(() => pendingLogos.delete(key));
  pendingLogos.set(key, promise);
  return promise;
}

export function RetroTeamMark({ team }: { team: RetroTeam }) {
  const key = useMemo(() => assetKey(team), [team.countryId, team.name, team.slug]);
  const [resolvedLogo, setResolvedLogo] = useState<string | undefined>(() => team.logo || logoCache.get(key) || undefined);

  useEffect(() => {
    let active = true;
    if (team.logo) {
      logoCache.set(key, team.logo);
      setResolvedLogo(team.logo);
      return () => { active = false; };
    }
    const cached = logoCache.get(key);
    if (cached !== undefined) {
      setResolvedLogo(cached || undefined);
      return () => { active = false; };
    }
    setResolvedLogo(undefined);
    void requestLogo(team).then((logo) => {
      if (active) setResolvedLogo(logo || undefined);
    });
    return () => { active = false; };
  }, [key, team.countryId, team.logo, team.name, team.slug]);

  return <TeamMark name={team.name} logo={resolvedLogo} />;
}
