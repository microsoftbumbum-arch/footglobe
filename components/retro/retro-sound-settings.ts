"use client";

import { useCallback, useEffect, useState } from "react";

const ENABLED_KEY = "footglobe-retro-sound-enabled";
const VOLUME_KEY = "footglobe-retro-sound-volume";
const EVENT_NAME = "footglobe:retro-sound-change";
const AUDIO_SETTINGS_VERSION_KEY = "footglobe-retro-sound-settings-version";
const AUDIO_SETTINGS_VERSION = "2";

export interface RetroSoundSettings {
  enabled: boolean;
  volume: number;
}

function readSettings(): RetroSoundSettings {
  if (typeof window === "undefined") return { enabled: true, volume: 0.8 };
  try {
    const storedEnabled = window.localStorage.getItem(ENABLED_KEY);
    const enabled = storedEnabled === null ? true : storedEnabled === "1";
    const rawVolume = window.localStorage.getItem(VOLUME_KEY);
    // Number(null) is 0. On a first visit that silently muted every Retro goal
    // even though the UI is supposed to default to 80%. Treat an absent or blank
    // value as "not configured" instead of converting it to zero.
    const storedVolume = rawVolume === null || rawVolume.trim() === "" ? Number.NaN : Number(rawVolume);
    let volume = Number.isFinite(storedVolume) ? Math.min(1, Math.max(0, storedVolume)) : 0.8;
    // Earlier FootGlobe builds could accidentally persist 0 on a first visit. Migrate
    // that legacy state once so existing users are not permanently silent.
    const settingsVersion = window.localStorage.getItem(AUDIO_SETTINGS_VERSION_KEY);
    if (settingsVersion !== AUDIO_SETTINGS_VERSION) {
      if (enabled && volume === 0) volume = 0.8;
      window.localStorage.setItem(AUDIO_SETTINGS_VERSION_KEY, AUDIO_SETTINGS_VERSION);
      window.localStorage.setItem(VOLUME_KEY, String(volume));
    }
    return { enabled, volume };
  } catch {
    return { enabled: true, volume: 0.8 };
  }
}

function publish(next: RetroSoundSettings) {
  try {
    window.localStorage.setItem(ENABLED_KEY, next.enabled ? "1" : "0");
    window.localStorage.setItem(VOLUME_KEY, String(next.volume));
  } catch { /* keep this session's settings even if storage is blocked */ }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
}

export function useRetroSoundSettings() {
  const [settings, setSettings] = useState<RetroSoundSettings>(() => readSettings());

  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<RetroSoundSettings>).detail;
      setSettings(detail ?? readSettings());
    };
    window.addEventListener(EVENT_NAME, sync);
    return () => window.removeEventListener(EVENT_NAME, sync);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    const next = { ...readSettings(), enabled };
    setSettings(next);
    publish(next);
  }, []);

  const setVolume = useCallback((volume: number) => {
    const next = { ...readSettings(), volume: Math.min(1, Math.max(0, volume)) };
    setSettings(next);
    publish(next);
  }, []);

  return { ...settings, setEnabled, setVolume };
}
