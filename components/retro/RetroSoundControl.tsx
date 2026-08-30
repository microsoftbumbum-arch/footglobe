"use client";

import { Play, Volume2, VolumeX } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/i18n/I18nProvider";
import { createRetroGoalTestDetail, RETRO_GOAL_TEST_EVENT } from "./retro-goal-test";
import { playRetroGoalAudio, retroGoalAudioToken, unlockRetroGoalAudio } from "./retro-goal-audio";
import { useRetroSoundSettings } from "./retro-sound-settings";

export function RetroSoundControl({ className = "", hidden = false }: { className?: string; hidden?: boolean }) {
  const { t } = useI18n();
  const { enabled, volume, setEnabled, setVolume } = useRetroSoundSettings();

  const testGoal = () => {
    // This handler is a real click. Unlock Web Audio *before* any async work so
    // Chrome/Safari associate the sound engine with the user's gesture.
    unlockRetroGoalAudio();
    const testVolume = volume > 0 ? volume : 0.8;
    if (!enabled) setEnabled(true);
    if (volume <= 0) setVolume(testVolume);
    const detail = createRetroGoalTestDetail(testVolume);
    detail.audioAlreadyStarted = true;
    void playRetroGoalAudio(retroGoalAudioToken(detail.fixture.id, detail.event.id), testVolume);
    window.dispatchEvent(new CustomEvent(RETRO_GOAL_TEST_EVENT, { detail }));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`${className || "preference-button"} retro-sound-button ${enabled ? "is-on" : ""}`}
          aria-label={t("retroSounds")}
          title={t("retroSounds")}
          aria-hidden={hidden}
          tabIndex={hidden ? -1 : 0}
        >
          {enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          {!className && <span>{t("retroSoundsShort")}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="retro-sound-popover" align="end">
        <div className="retro-sound-head"><b>{t("retroSounds")}</b><span>{enabled ? t("on") : t("off")}</span></div>
        <button className="retro-sound-toggle" type="button" onClick={() => setEnabled(!enabled)} aria-pressed={enabled}>
          {enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}{enabled ? t("on") : t("off")}
        </button>
        <label className="retro-volume-label">
          <span>{t("volume")}</span><b>{Math.round(volume * 100)}%</b>
          <input type="range" min="0" max="100" step="1" value={Math.round(volume * 100)} onChange={(event) => setVolume(Number(event.target.value) / 100)} />
        </label>
        <button className="retro-goal-test-button" type="button" onClick={testGoal} title={t("retroTestGoal")}>
          <Play size={13} fill="currentColor" />
          <span>{t("retroTestGoal")}</span>
          <small>20</small>
        </button>
      </PopoverContent>
    </Popover>
  );
}
