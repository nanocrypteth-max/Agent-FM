"use client";

import { useCallback, useRef, useEffect } from "react";

/**
 * Two-tier hover sound system:
 * - "subtle": soft tick for normal buttons/links (nav, filter chips, etc.)
 * - "cta": slightly more prominent click/pop for primary action buttons
 *
 * Both generated via Web Audio API — no external files needed,
 * zero latency, works offline.
 */

type SoundTier = "subtle" | "cta";

// Lazily created AudioContext — browsers require user gesture before creating
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext ?? (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function playSubtle() {
  const ac = getCtx();
  if (!ac) return;
  // Soft high-pitched tick: short sine burst at 880Hz
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(660, ac.currentTime + 0.05);
  gain.gain.setValueAtTime(0.06, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.06);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.06);
}

function playCta() {
  const ac = getCtx();
  if (!ac) return;
  // Richer pop: two oscillators (fundamental + harmonic) for a satisfying click
  const t = ac.currentTime;

  const osc1 = ac.createOscillator();
  const osc2 = ac.createOscillator();
  const gain = ac.createGain();

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ac.destination);

  osc1.type = "triangle";
  osc1.frequency.setValueAtTime(440, t);
  osc1.frequency.exponentialRampToValueAtTime(220, t + 0.08);

  osc2.type = "sine";
  osc2.frequency.setValueAtTime(660, t);
  osc2.frequency.exponentialRampToValueAtTime(330, t + 0.06);

  gain.gain.setValueAtTime(0.14, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);

  osc1.start(t); osc1.stop(t + 0.10);
  osc2.start(t); osc2.stop(t + 0.10);
}

/**
 * Hook: returns event handler props to spread on any element.
 *
 * Usage:
 *   const hover = useHoverSound("subtle");
 *   <button {...hover}>Click me</button>
 *
 *   const ctaHover = useHoverSound("cta");
 *   <button {...ctaHover}>Sign Player</button>
 */
export function useHoverSound(tier: SoundTier = "subtle") {
  const lastFired = useRef(0);

  const onMouseEnter = useCallback(() => {
    // Throttle: don't fire more than once per 80ms (rapid mouse movement)
    const now = Date.now();
    if (now - lastFired.current < 80) return;
    lastFired.current = now;
    tier === "subtle" ? playSubtle() : playCta();
  }, [tier]);

  return { onMouseEnter };
}

/**
 * Utility: returns a className + onMouseEnter prop object.
 * Useful for spreading onto many elements with the same sound tier.
 */
export function hoverSound(tier: SoundTier = "subtle") {
  return {
    onMouseEnter: () => {
      const now = Date.now();
      tier === "subtle" ? playSubtle() : playCta();
    },
  };
}
