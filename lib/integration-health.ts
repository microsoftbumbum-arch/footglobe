export type IntegrationHealthStatus = "idle" | "ok" | "degraded" | "blocked" | "error";

export interface IntegrationHealthEntry {
  status: IntegrationHealthStatus;
  updatedAt: string;
  code?: string;
  httpStatus?: number;
}

type HealthMap = Record<string, IntegrationHealthEntry>;

declare global {
  // eslint-disable-next-line no-var
  var __footglobeIntegrationHealth: HealthMap | undefined;
}

function store(): HealthMap {
  if (!globalThis.__footglobeIntegrationHealth) globalThis.__footglobeIntegrationHealth = {};
  return globalThis.__footglobeIntegrationHealth;
}

export function recordIntegrationHealth(name: string, entry: Omit<IntegrationHealthEntry, "updatedAt">) {
  store()[name] = { ...entry, updatedAt: new Date().toISOString() };
}

export function getIntegrationHealth(): HealthMap {
  return { ...store() };
}
