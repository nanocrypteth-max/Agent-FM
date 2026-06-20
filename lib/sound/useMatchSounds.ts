"use client";

import { useRef, useCallback, useEffect, useState } from "react";

/**
 * Sound URLs — Mixkit (free, no attribution required: https://mixkit.co/license/).
 * VERIFY THESE LINKS ARE STILL LIVE before relying on them — Mixkit occasionally
 * reorganizes their CDN paths. If a link breaks, replace with any short MP3/WAV
 * from https://mixkit.co/free-sound-effects/ (search "whistle", "crowd", "kick", "ball").
 */
const SOUND_URLS = {
  kickoff: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3", // referee whistle (short, match start)
  goal: "https://assets.mixkit.co/active_storage/sfx/2002/2002-preview.mp3", // crowd cheer / horn
  whistleEnd:
    "https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3", // double whistle (full-time)
  cardYellow:
    "https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3", // short referee whistle (foul/card)
  kick: "https://assets.mixkit.co/active_storage/sfx/2645/2645-preview.mp3", // football kick / ball strike
  save: "https://assets.mixkit.co/active_storage/sfx/2645/2645-preview.mp3", // glove catch / parry sound (reusing kick as fallback)
  crowdAmbience:
    "https://assets.mixkit.co/active_storage/sfx/2515/2515-preview.mp3", // low stadium crowd murmur loop
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
  const ambienceRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Preload all one-shot sounds on mount
    for (const key of Object.keys(SOUND_URLS) as SoundKey[]) {
      if (key === "crowdAmbience") continue; // handled separately as a loop
      const audio = new Audio(SOUND_URLS[key]);
      audio.preload = "auto";
      audio.volume =
        key === "goal" ? 0.6 : key === "kick" || key === "save" ? 0.35 : 0.4;
      audio.addEventListener("error", () => {
        console.warn(`[sound] Failed to load "${key}" from ${SOUND_URLS[key]}`);
      });
      audioRefs.current[key] = audio;
    }

    // Looping crowd ambience — low volume background atmosphere during live match
    const ambience = new Audio(SOUND_URLS.crowdAmbience);
    ambience.loop = true;
    ambience.volume = 0.08;
    ambience.preload = "auto";
    ambience.addEventListener("error", () => {
      console.warn("[sound] Failed to load crowd ambience");
    });
    ambienceRef.current = ambience;

    setReady(true);

    return () => {
      for (const audio of Object.values(audioRefs.current)) audio?.pause();
      ambienceRef.current?.pause();
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
    [muted],
  );

  /** Start the looping stadium ambience (call once when match simulation begins) */
  const startAmbience = useCallback(() => {
    if (muted || !ambienceRef.current) return;
    ambienceRef.current.currentTime = 0;
    void ambienceRef.current.play().catch(() => {});
  }, [muted]);

  /** Stop the ambience loop (call on full-time or when leaving the match page) */
  const stopAmbience = useCallback(() => {
    ambienceRef.current?.pause();
  }, []);

  // If user mutes mid-match, also stop the ambience loop
  useEffect(() => {
    if (muted) ambienceRef.current?.pause();
  }, [muted]);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  return { play, muted, toggleMute, ready, startAmbience, stopAmbience };
}

/**
 * Maps a MatchEvent type to a sound effect key. Returns null for events
 * that shouldn't trigger sound.
 */
export function eventToSound(eventType: string): SoundKey | null {
  switch (eventType) {
    case "KICK_OFF":
      return "kickoff";
    case "GOAL":
      return "goal";
    case "SHOT":
      return "kick";
    case "SAVE":
      return "save";
    case "FULL_TIME":
      return "whistleEnd";
    case "YELLOW_CARD":
    case "RED_CARD":
      return "cardYellow";
    default:
      return null;
  }
}
