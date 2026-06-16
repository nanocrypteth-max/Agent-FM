"use client";

import { useRef, useCallback, useEffect, useState } from "react";

/**
 * Sound URLs — Mixkit (free, no attribution required: https://mixkit.co/license/).
 * VERIFY THESE LINKS ARE STILL LIVE before relying on them — Mixkit occasionally
 * reorganizes their CDN paths. If a link breaks, replace with any short MP3/WAV
 * from https://mixkit.co/free-sound-effects/ (search "whistle", "crowd", "horn").
 */
const SOUND_URLS = {
  kickoff: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3", // referee whistle (short)
  goal: "https://assets.mixkit.co/active_storage/sfx/2002/2002-preview.mp3", // crowd cheer / horn
  whistleEnd: "https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3", // double whistle (full-time)
  cardYellow: "https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3", // short referee whistle (foul/card)
};

type SoundKey = keyof typeof SOUND_URLS;

/**
 * Preloads and plays short sound effects tied to match events.
 * Falls back silently (no error thrown to UI) if a URL fails to load —
 * sound is an enhancement, not a requirement for gameplay.
 *
 * Usage:
 *   const { play, muted, toggleMute } = useMatchSounds();
 *   play("goal");
 */
export function useMatchSounds() {
  const audioRefs = useRef<Partial<Record<SoundKey, HTMLAudioElement>>>({});
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Preload all sounds on mount
    for (const key of Object.keys(SOUND_URLS) as SoundKey[]) {
      const audio = new Audio(SOUND_URLS[key]);
      audio.preload = "auto";
      audio.volume = key === "goal" ? 0.6 : 0.4;
      // Swallow load errors — if a CDN link is dead, just skip that sound
      audio.addEventListener("error", () => {
        console.warn(`[sound] Failed to load "${key}" from ${SOUND_URLS[key]}`);
      });
      audioRefs.current[key] = audio;
    }
    setReady(true);

    return () => {
      for (const audio of Object.values(audioRefs.current)) {
        audio?.pause();
      }
    };
  }, []);

  const play = useCallback(
    (key: SoundKey) => {
      if (muted) return;
      const audio = audioRefs.current[key];
      if (!audio) return;

      // Clone-and-play pattern: allows overlapping sounds (e.g. rapid goals)
      // without waiting for the previous instance to finish.
      try {
        const instance = audio.cloneNode(true) as HTMLAudioElement;
        instance.volume = audio.volume;
        void instance.play().catch(() => {
          // Autoplay policies may block play() until user interacts with the page —
          // this is expected on first load and not a real error.
        });
      } catch {
        // no-op — sound is non-critical
      }
    },
    [muted]
  );

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  return { play, muted, toggleMute, ready };
}

/**
 * Maps a MatchEvent type to a sound effect key. Returns null for events
 * that shouldn't trigger sound (e.g. SHOT, SUBSTITUTION).
 */
export function eventToSound(eventType: string): SoundKey | null {
  switch (eventType) {
    case "KICK_OFF":
      return "kickoff";
    case "GOAL":
      return "goal";
    case "FULL_TIME":
      return "whistleEnd";
    case "YELLOW_CARD":
    case "RED_CARD":
      return "cardYellow";
    default:
      return null;
  }
}
