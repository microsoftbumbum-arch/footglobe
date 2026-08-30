"use client";

import { RETRO_GOAL_AUDIO_DATA_URL } from "./retro-goal-audio-data";

// Keep the public URL as a final emergency fallback, but normal playback uses the
// embedded data URL so Discloud/Vinext static-file routing cannot make goals silent.
export const RETRO_GOAL_AUDIO_URL = "/retro-goal-announcement.mp3";

type PendingPlayback = { token: string; volume: number };
type WebkitWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

let media: HTMLAudioElement | null = null;
let mediaPrimed = false;
let audioContext: AudioContext | null = null;
let decodedBufferPromise: Promise<AudioBuffer> | null = null;
let activeSource: AudioBufferSourceNode | null = null;
let activeGain: GainNode | null = null;
let playingToken: string | null = null;
let pendingPlayback: PendingPlayback | null = null;
let unlockAttempted = false;

function clampVolume(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.8));
}

export function retroGoalAudioToken(fixtureId: string, eventId: string) {
  return `retro-goal:${fixtureId}:${eventId}`;
}

function ensureMedia() {
  if (typeof document === "undefined") return null;
  if (media) return media;

  const element = document.createElement("audio");
  element.id = "footglobe-retro-goal-audio";
  element.preload = "auto";
  element.playsInline = true;
  element.setAttribute("playsinline", "");
  element.setAttribute("webkit-playsinline", "");
  element.src = RETRO_GOAL_AUDIO_DATA_URL;
  element.style.position = "fixed";
  element.style.width = "1px";
  element.style.height = "1px";
  element.style.opacity = "0";
  element.style.pointerEvents = "none";
  element.style.left = "-9999px";
  document.body.appendChild(element);
  media = element;
  return element;
}

function getAudioContext(create = true): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioContext || !create) return audioContext;
  const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!Ctor) return null;
  try { audioContext = new Ctor(); } catch { audioContext = null; }
  return audioContext;
}

function embeddedAudioBytes() {
  const comma = RETRO_GOAL_AUDIO_DATA_URL.indexOf(",");
  const encoded = comma >= 0 ? RETRO_GOAL_AUDIO_DATA_URL.slice(comma + 1) : RETRO_GOAL_AUDIO_DATA_URL;
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function getDecodedBuffer(context: AudioContext) {
  if (!decodedBufferPromise) {
    decodedBufferPromise = context.decodeAudioData(embeddedAudioBytes().slice(0)).catch((error) => {
      decodedBufferPromise = null;
      throw error;
    });
  }
  return decodedBufferPromise;
}

function stopWebAudio() {
  if (activeSource) {
    try { activeSource.stop(); } catch { /* already stopped */ }
    try { activeSource.disconnect(); } catch { /* best effort */ }
    activeSource = null;
  }
  if (activeGain) {
    try { activeGain.disconnect(); } catch { /* best effort */ }
    activeGain = null;
  }
}

function resetMedia() {
  if (!media) return;
  try {
    media.pause();
    media.currentTime = 0;
  } catch { /* best effort */ }
}

// Run from the Retro mode click or another real user gesture. Priming the SAME
// persistent media element makes later goal playback much more reliable than
// constructing a brand-new Audio() object after the goal has already happened.
export function unlockRetroGoalAudio() {
  if (typeof window === "undefined") return;
  unlockAttempted = true;

  const element = ensureMedia();
  if (element && !mediaPrimed) {
    try {
      resetMedia();
      element.muted = false;
      element.defaultMuted = false;
      element.volume = 0.001; // audible-media path, effectively inaudible to the user
      const result = element.play(); // IMPORTANT: invoked synchronously in the gesture
      if (result && typeof result.then === "function") {
        void result.then(() => {
          window.setTimeout(() => {
            try {
              element.pause();
              element.currentTime = 0;
              element.volume = 0.8;
              mediaPrimed = true;
            } catch { /* best effort */ }
          }, 25);
        }).catch(() => undefined);
      } else {
        mediaPrimed = true;
        resetMedia();
      }
    } catch { /* Web Audio below is another unlock path */ }
  }

  const context = getAudioContext(true);
  if (context) {
    try {
      if (context.state === "suspended") void context.resume();
      const silent = context.createBuffer(1, 1, context.sampleRate || 44_100);
      const source = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = 0;
      source.buffer = silent;
      source.connect(gain);
      gain.connect(context.destination);
      source.start(0);
      source.onended = () => {
        try { source.disconnect(); } catch { /* best effort */ }
        try { gain.disconnect(); } catch { /* best effort */ }
      };
    } catch { /* media element remains primary */ }
  }
}

export function preloadRetroGoalAudio() {
  if (typeof window === "undefined") return;
  const element = ensureMedia();
  try { element?.load(); } catch { /* best effort */ }
}

// Media is primary now. Crucially, there is no await/fetch/decode before play().
// When called from the Test button, play() executes inside the click activation.
function playWithPersistentMedia(token: string, volume: number): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const element = ensureMedia();
  if (!element) return Promise.resolve(false);

  try {
    stopWebAudio();
    resetMedia();
    element.muted = false;
    element.defaultMuted = false;
    element.volume = clampVolume(volume);
    playingToken = token;
    element.onended = () => {
      if (playingToken === token) playingToken = null;
    };
    const result = element.play(); // do not move this behind any await
    if (result && typeof result.then === "function") {
      return result.then(() => {
        mediaPrimed = true;
        return true;
      }).catch(() => {
        if (playingToken === token) playingToken = null;
        return false;
      });
    }
    mediaPrimed = true;
    return Promise.resolve(true);
  } catch {
    if (playingToken === token) playingToken = null;
    return Promise.resolve(false);
  }
}

async function playWithWebAudio(token: string, volume: number): Promise<boolean> {
  const context = getAudioContext(true);
  if (!context) return false;
  try {
    if (context.state === "suspended") await context.resume();
    if (context.state !== "running") return false;
    const buffer = await getDecodedBuffer(context);
    if (context.state === "suspended") await context.resume();
    if (context.state !== "running") return false;

    resetMedia();
    stopWebAudio();
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    // The bundled MP3 has already been safely normalized; keep extra gain modest.
    gain.gain.value = Math.min(1.35, clampVolume(volume) * 1.25);
    source.connect(gain);
    gain.connect(context.destination);
    activeSource = source;
    activeGain = gain;
    playingToken = token;
    source.onended = () => {
      if (activeSource === source) activeSource = null;
      if (activeGain === gain) activeGain = null;
      try { source.disconnect(); } catch { /* best effort */ }
      try { gain.disconnect(); } catch { /* best effort */ }
      if (playingToken === token) playingToken = null;
    };
    source.start(0);
    return true;
  } catch {
    return false;
  }
}

export async function playRetroGoalAudio(token: string, volume: number): Promise<boolean> {
  const nextVolume = clampVolume(volume);
  if (nextVolume <= 0) {
    pendingPlayback = null;
    return false;
  }

  // IMPORTANT: this call happens before the first await inside this function.
  const mediaAttempt = playWithPersistentMedia(token, nextVolume);
  const mediaPlayed = await mediaAttempt;
  if (mediaPlayed) {
    pendingPlayback = null;
    return true;
  }

  // If a browser rejects media playback, reuse the already-unlocked AudioContext.
  const webAudioPlayed = await playWithWebAudio(token, nextVolume);
  if (webAudioPlayed) {
    pendingPlayback = null;
    return true;
  }

  playingToken = null;
  pendingPlayback = { token, volume: nextVolume };
  return false;
}

export function retryPendingRetroGoalAudio() {
  const pending = pendingPlayback;
  if (!pending) return;
  unlockRetroGoalAudio();
  void playRetroGoalAudio(pending.token, pending.volume);
}

export function stopRetroGoalAudio(token?: string) {
  if (pendingPlayback && (!token || pendingPlayback.token === token)) pendingPlayback = null;
  if (token && playingToken && playingToken !== token) return;
  resetMedia();
  stopWebAudio();
  if (!token || playingToken === token) playingToken = null;
}

export function retroGoalAudioWasUnlocked() {
  return mediaPrimed || Boolean(unlockAttempted && audioContext && audioContext.state === "running");
}
