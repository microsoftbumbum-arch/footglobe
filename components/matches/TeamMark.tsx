"use client";

import { useEffect, useState } from "react";

const initials = (name: string) => name.split(/[-\s]/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

export function TeamMark({ name, logo }: { name: string; logo?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logo]);
  if (logo && !failed) return <img className="team-logo" src={logo} alt="" width={30} height={30} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
  return <span className="team-logo team-fallback" aria-hidden="true">{initials(name)}</span>;
}
