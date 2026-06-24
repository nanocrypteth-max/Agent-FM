"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { MatchEvent, Position2D } from "@/lib/match-engine/types";

interface PitchViewProps {
  events: MatchEvent[];
  homeStartingXI: string[];
  awayStartingXI: string[];
  homeFormationSlots: Position2D[];
  awayFormationSlots: Position2D[];
  speed?: number;
  onMinuteChange?: (minute: number, eventsThisMinute: MatchEvent[]) => void;
  /** If true, playback is paused (no new events applied) */
  paused?: boolean;
}

const PLAYER_RADIUS_PCT = 0.021;
const BALL_RADIUS_PCT = 0.008;
const TRANSITION_DURATION_MS = 600;
const MAX_DELAY_MS = 1600; // cap "dead air" between far-apart events

const COLORS = {
  pitchA: "#1e5631",
  pitchB: "#184a28",
  line: "rgba(255,255,255,0.35)",
  home: "#ff5252",
  away: "#4fc3f7",
  ball: "#ffffff",
};

interface PlayerState {
  id: string;
  team: "HOME" | "AWAY";
  current: Position2D;
  target: Position2D;
  transitionStart: number;
}

export default function PitchView({
  events,
  homeStartingXI,
  awayStartingXI,
  homeFormationSlots,
  awayFormationSlots,
  speed = 1,
  onMinuteChange,
  paused = false,
}: PitchViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>();

  const [eventIndex, setEventIndex] = useState(0);
  const playersRef = useRef<Map<string, PlayerState>>(new Map());
  const ballRef = useRef<{
    current: Position2D;
    target: Position2D;
    transitionStart: number;
  }>({
    current: { x: 50, y: 50 },
    target: { x: 50, y: 50 },
    transitionStart: performance.now(),
  });

  // Track previous startingXI to avoid spurious resets when parent re-renders
  const prevStartingXIRef = useRef<string>("");

  useEffect(() => {
    const key = JSON.stringify([homeStartingXI, awayStartingXI]);
    const changed = key !== prevStartingXIRef.current;
    prevStartingXIRef.current = key;

    const map = new Map<string, PlayerState>();
    homeStartingXI.forEach((id, i) => {
      const pos = homeFormationSlots[i] ?? { x: 50, y: 50 };
      map.set(id, {
        id,
        team: "HOME",
        current: pos,
        target: pos,
        transitionStart: performance.now(),
      });
    });
    awayStartingXI.forEach((id, i) => {
      const pos = awayFormationSlots[i] ?? { x: 50, y: 50 };
      map.set(id, {
        id,
        team: "AWAY",
        current: pos,
        target: pos,
        transitionStart: performance.now(),
      });
    });
    playersRef.current = map;

    // Only reset event playback when startingXI actually changes content.
    // This prevents resetting on every parent re-render which causes the
    // "looping KICK_OFF" bug where eventIndex resets to 0 mid-playback.
    if (changed && homeStartingXI.length > 0) {
      setEventIndex(0);
    }
  }, [homeStartingXI, awayStartingXI, homeFormationSlots, awayFormationSlots]);

  useEffect(() => {
    if (paused) return;
    if (eventIndex >= events.length) return;

    const event = events[eventIndex];
    const prevEvent = events[eventIndex - 1];

    const minuteGap = prevEvent ? event.minute - prevEvent.minute : 0;
    const delayMs = Math.min(
      MAX_DELAY_MS,
      Math.max(80, (minuteGap * 800) / speed),
    );

    const timer = setTimeout(() => {
      applyEvent(event);
      setEventIndex((i) => i + 1);

      if (!prevEvent || event.minute !== prevEvent.minute) {
        const eventsThisMinute = events.filter(
          (e) => e.minute === event.minute,
        );
        onMinuteChange?.(event.minute, eventsThisMinute);
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [eventIndex, events, speed, onMinuteChange, paused]);

  const applyEvent = useCallback((event: MatchEvent) => {
    const now = performance.now();

    ballRef.current = {
      current: ballRef.current.target,
      target: event.position,
      transitionStart: now,
    };

    if (event.playerId) {
      const player = playersRef.current.get(event.playerId);
      if (player) {
        playersRef.current.set(event.playerId, {
          ...player,
          current: player.target,
          target: event.position,
          transitionStart: now,
        });
      }
    }

    if (
      event.type === "GOAL" ||
      event.type === "HALF_TIME" ||
      event.type === "KICK_OFF"
    ) {
      resetToFormation(now);
    }
  }, []);

  const resetToFormation = (now: number) => {
    homeStartingXI.forEach((id, i) => {
      const pos = homeFormationSlots[i] ?? { x: 50, y: 50 };
      const p = playersRef.current.get(id);
      if (p)
        playersRef.current.set(id, {
          ...p,
          current: p.target,
          target: pos,
          transitionStart: now,
        });
    });
    awayStartingXI.forEach((id, i) => {
      const pos = awayFormationSlots[i] ?? { x: 50, y: 50 };
      const p = playersRef.current.get(id);
      if (p)
        playersRef.current.set(id, {
          ...p,
          current: p.target,
          target: pos,
          transitionStart: now,
        });
    });
    ballRef.current = {
      current: ballRef.current.target,
      target: { x: 50, y: 50 },
      transitionStart: now,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const { width, height } = canvas;
      const now = performance.now();

      ctx.clearRect(0, 0, width, height);
      drawPitch(ctx, width, height);

      for (const player of playersRef.current.values()) {
        const pos = interpolate(
          player.current,
          player.target,
          player.transitionStart,
          now,
        );
        drawPlayer(
          ctx,
          pos,
          width,
          height,
          PLAYER_RADIUS_PCT,
          player.team === "HOME" ? COLORS.home : COLORS.away,
        );
      }

      const ballPos = interpolate(
        ballRef.current.current,
        ballRef.current.target,
        ballRef.current.transitionStart,
        now,
      );
      drawBall(ctx, ballPos, width, height, BALL_RADIUS_PCT);

      animFrameRef.current = requestAnimationFrame(draw);
    };

    const resize = () => {
      const w = container.clientWidth;
      const h = w * (68 / 105);
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    window.addEventListener("resize", resize);

    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", resize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", display: "block", borderRadius: 6 }}
      />
    </div>
  );
}

function drawPitch(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const stripeCount = 9;
  const stripeWidth = w / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? COLORS.pitchA : COLORS.pitchB;
    ctx.fillRect(i * stripeWidth, 0, stripeWidth, h);
  }

  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;

  const m = w * 0.03;
  ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);

  ctx.beginPath();
  ctx.moveTo(w / 2, m);
  ctx.lineTo(w / 2, h - m);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w * 0.08, 0, Math.PI * 2);
  ctx.stroke();

  const boxW = w * 0.14;
  const boxH = h * 0.56;
  ctx.strokeRect(m, (h - boxH) / 2, boxW, boxH);
  ctx.strokeRect(w - m - boxW, (h - boxH) / 2, boxW, boxH);

  const sixW = w * 0.05;
  const sixH = h * 0.28;
  ctx.strokeRect(m, (h - sixH) / 2, sixW, sixH);
  ctx.strokeRect(w - m - sixW, (h - sixH) / 2, sixW, sixH);
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  pos: Position2D,
  w: number,
  h: number,
  radiusPct: number,
  color: string,
) {
  const x = (pos.x / 100) * w;
  const y = (pos.y / 100) * h;
  const r = radiusPct * w;

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  pos: Position2D,
  w: number,
  h: number,
  radiusPct: number,
) {
  const x = (pos.x / 100) * w;
  const y = (pos.y / 100) * h;
  const r = radiusPct * w;

  // White circle base
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = "#222";
  ctx.stroke();

  // Central pentagon patch
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const px = x + r * 0.42 * Math.cos(angle);
    const py = y + r * 0.42 * Math.sin(angle);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#111";
  ctx.fill();

  // 5 outer hexagon patches
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const px = x + r * 0.72 * Math.cos(angle);
    const py = y + r * 0.72 * Math.sin(angle);
    ctx.beginPath();
    for (let j = 0; j < 5; j++) {
      const a2 = angle + (Math.PI * 2 * j) / 5;
      const hx = px + r * 0.28 * Math.cos(a2);
      const hy = py + r * 0.28 * Math.sin(a2);
      j === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fillStyle = "#111";
    ctx.fill();
  }

  // Shine highlight
  ctx.beginPath();
  ctx.arc(x - r * 0.28, y - r * 0.28, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
}

function interpolate(
  from: Position2D,
  to: Position2D,
  startTime: number,
  now: number,
): Position2D {
  const elapsed = now - startTime;
  const t = Math.min(1, elapsed / TRANSITION_DURATION_MS);
  const eased = 1 - Math.pow(1 - t, 3);
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
  };
}
