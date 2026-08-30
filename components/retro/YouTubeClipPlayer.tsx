"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, RotateCcw, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import type { RetroClip } from "@/types/retro";

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  destroy: () => void;
}

interface YTNamespace {
  Player: new (element: HTMLElement, options: Record<string, unknown>) => YTPlayerInstance;
  PlayerState?: { ENDED?: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeReadyPromise: Promise<YTNamespace> | null = null;

function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeReadyPromise) return youtubeReadyPromise;

  youtubeReadyPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("youtube_iframe_unavailable"));
    };

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("youtube_iframe_unavailable"));
      document.head.appendChild(script);
    }
    window.setTimeout(() => {
      if (window.YT?.Player) resolve(window.YT);
    }, 2_000);
  });
  return youtubeReadyPromise;
}

export function YouTubeClipPlayer({ clip, autoPlay = true, onClose, onEnded }: { clip: RetroClip & { videoId: string }; autoPlay?: boolean; onClose?: () => void; onEnded?: () => void }) {
  const { t } = useI18n();
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [ended, setEnded] = useState(false);
  const endedRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  const startSeconds = Math.max(0, clip.startSeconds ?? 0);
  const endSeconds = clip.endSeconds && clip.endSeconds > startSeconds ? clip.endSeconds : undefined;

  const play = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    setBlocked(false);
    endedRef.current = false;
    setEnded(false);
    player.seekTo(startSeconds, true);
    player.playVideo();
  }, [startSeconds]);

  useEffect(() => {
    let cancelled = false;
    let monitor: number | undefined;
    let player: YTPlayerInstance | null = null;

    loadYouTubeIframeApi().then((YT) => {
      if (cancelled || !mountRef.current) return;
      player = new YT.Player(mountRef.current, {
        videoId: clip.videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: autoPlay ? 1 : 0,
          controls: 1,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          start: Math.floor(startSeconds),
          ...(endSeconds ? { end: Math.ceil(endSeconds) } : {}),
        },
        events: {
          onReady: () => {
            if (!player || cancelled) return;
            player.seekTo(startSeconds, true);
            if (autoPlay) {
              try { player.playVideo(); } catch { setBlocked(true); }
            }
          },
          onAutoplayBlocked: () => setBlocked(true),
          onStateChange: (event: { data?: number }) => {
            if (event.data === YT.PlayerState?.ENDED) {
              if (!endedRef.current) {
                endedRef.current = true;
                setEnded(true);
                onEndedRef.current?.();
              }
            }
          },
        },
      });
      playerRef.current = player;

      if (endSeconds) {
        monitor = window.setInterval(() => {
          const current = playerRef.current?.getCurrentTime?.() ?? 0;
          if (current >= endSeconds - 0.1) {
            playerRef.current?.pauseVideo();
            if (!endedRef.current) {
              endedRef.current = true;
              setEnded(true);
              onEndedRef.current?.();
            }
          }
        }, 250);
      }
    }).catch(() => setBlocked(true));

    return () => {
      cancelled = true;
      if (monitor) window.clearInterval(monitor);
      try { playerRef.current?.destroy(); } catch { /* iframe may already be gone */ }
      playerRef.current = null;
    };
  }, [autoPlay, clip.videoId, endSeconds, startSeconds]);

  return (
    <div className="retro-clip-player">
      <div className="retro-clip-frame"><div ref={mountRef} /></div>
      <div className="retro-clip-actions">
        {(blocked || !autoPlay) && !ended && <button type="button" onClick={play}><Play size={13} />{t("retroViewClip")}</button>}
        {ended && <button type="button" onClick={play}><RotateCcw size={13} />{t("retroReviewClip")}</button>}
        {onClose && <button type="button" onClick={onClose}><X size={13} />{t("close")}</button>}
      </div>
    </div>
  );
}
