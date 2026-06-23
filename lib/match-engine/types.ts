import type { Position, Player } from "@prisma/client";

export type EventType =
  | "KICK_OFF"
  | "SHOT"
  | "GOAL"
  | "SAVE"
  | "FOUL"
  | "YELLOW_CARD"
  | "RED_CARD"
  | "CORNER"
  | "OFFSIDE"
  | "SUBSTITUTION"
  | "HALF_TIME"
  | "FULL_TIME";

export interface Position2D {
  x: number; // 0-100, percentage of pitch length (0 = home goal, 100 = away goal)
  y: number; // 0-100, percentage of pitch width
}

export interface MatchEvent {
  minute: number;
  second: number;
  type: EventType;
  team: "HOME" | "AWAY";
  playerId: string | null;
  position: Position2D;
  meta?: {
    outcome?: "ON_TARGET" | "OFF_TARGET" | "BLOCKED";
    relatedPlayerId?: string;
  };
}

export type Formation =
  | "4-4-2"
  | "4-3-3"
  | "4-2-3-1"
  | "3-5-2"
  | "5-3-2"
  | "4-5-1"
  | "4-4-1-1"
  | "4-3-1-2";
export type Mentality = "DEFENSIVE" | "BALANCED" | "ATTACKING";
export type Pressing = "LOW" | "MEDIUM" | "HIGH";
export type Tempo = "SLOW" | "NORMAL" | "FAST";
export type Width = "NARROW" | "NORMAL" | "WIDE";

export interface TacticsInput {
  formation: Formation;
  mentality: Mentality;
  startingXI: string[]; // player IDs, ordered by formation slot
  instructions: {
    pressing: Pressing;
    tempo: Tempo;
    width: Width;
  };
}

export interface MatchSimInput {
  homeTeam: TeamMatchData;
  awayTeam: TeamMatchData;
  homeTactics: TacticsInput;
  awayTactics: TacticsInput;
}

export type MatchPlayer = Pick<
  Player,
  "id" | "position" | "pace" | "shooting" | "passing" | "defending" | "stamina"
>;

export interface TeamMatchData {
  id: string;
  overallAtk: number;
  overallMid: number;
  overallDef: number;
  players: MatchPlayer[];
}

export interface MatchSimResult {
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
}

// Re-export Prisma's Position enum for convenience
export type { Position };
