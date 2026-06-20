"use client";

import { useRef, useCallback, useEffect, useState } from "react";

const CROWD_AMBIENCE_URL = "/sounds/atmosphere-match.mp3"; // local file, ~7.8MB — lazy loaded, see startAmbience()

/**
 * Plays the looping stadium crowd ambience during live matches.
 * All other one-shot sound effects (whistle, goal cheer, kick, save, cards)
 * have been intentionally removed — only the background atmosphere remains.
 *
 * Usage:
 *   const { startAmbience, stopAmbience, muted, toggleMute } = useMatchSounds();
 *   startAmbience(); // call when match simulation begins
 *   stopAmbience();  // call on full-time or when leaving the page
 */
export function useMatchSounds() {
  const ambienceRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(true); // no eager preload needed anymore

  useEffect(() => {
    return () => {
      ambienceRef.current?.pause();
    };
  }, []);

  /**
   * Start the looping stadium ambience (call once when match simulation begins).
   * Lazily creates the Audio element on first call so the 7.8MB file is only
   * fetched when a match actually starts, not on every page load.
   */
  const startAmbience = useCallback(() => {
    if (muted) return;

    if (!ambienceRef.current) {
      const ambience = new Audio(CROWD_AMBIENCE_URL);
      ambience.loop = true;
      ambience.volume = 0.1;
      ambience.preload = "auto";
      ambience.addEventListener("error", () => {
        console.warn(
          `[sound] Failed to load crowd ambience from ${CROWD_AMBIENCE_URL}`,
        );
      });
      ambienceRef.current = ambience;
    }

    ambienceRef.current.currentTime = 0;
    void ambienceRef.current.play().catch(() => {
      // Autoplay may be blocked until user interaction — expected, not an error.
    });
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

  // `play` and `eventToSound` are kept as no-ops below for backward compatibility
  // with existing call sites in match/[id]/page.tsx, so no other file needs editing.
  const play = useCallback((_key: string) => {
    // Intentionally no-op — all one-shot sound effects have been removed.
  }, []);

  return { play, muted, toggleMute, ready, startAmbience, stopAmbience };
}

/**
 * Sound effects removed — this now always returns null so existing
 * eventToSound(...) call sites become harmless no-ops.
 */
export function eventToSound(_eventType: string): null {
  return null;
}
