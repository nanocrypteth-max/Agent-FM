import { GoogleGenerativeAI, SchemaType, FunctionDeclaration, FunctionCallingMode } from "@google/generative-ai";
import { z } from "zod";
import type { TacticsInput, Formation, Mentality, Pressing, Tempo, Width } from "../match-engine/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

const FORMATIONS = ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "5-3-2", "4-5-1"] as const;
const MENTALITIES = ["DEFENSIVE", "BALANCED", "ATTACKING"] as const;
const PRESSINGS = ["LOW", "MEDIUM", "HIGH"] as const;
const TEMPOS = ["SLOW", "NORMAL", "FAST"] as const;
const WIDTHS = ["NARROW", "NORMAL", "WIDE"] as const;

const TacticsSchema = z.object({
  formation: z.enum(FORMATIONS),
  mentality: z.enum(MENTALITIES),
  startingXI: z.array(z.string()).length(11),
  instructions: z.object({
    pressing: z.enum(PRESSINGS),
    tempo: z.enum(TEMPOS),
    width: z.enum(WIDTHS),
  }),
  reasoning: z.string().max(500),
});

export type TacticsResult = z.infer<typeof TacticsSchema>;

interface GenerateTacticsParams {
  teamName: string;
  squad: Array<{
    id: string;
    name: string;
    position: "GK" | "DF" | "MF" | "FW";
    pace: number;
    shooting: number;
    passing: number;
    defending: number;
    stamina: number;
  }>;
  opponentName?: string;
  opponentOverall?: { atk: number; mid: number; def: number };
  context: "SEASON_BASE" | "MATCH_SPECIFIC" | "HALF_TIME_ADJUSTMENT";
}

const SET_TACTICS_FUNCTION: FunctionDeclaration = {
  name: "set_tactics",
  description: "Set the team's tactical setup for the match",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      formation: {
        type: SchemaType.STRING,
        enum: [...FORMATIONS],
        format: "enum",
      },
      mentality: {
        type: SchemaType.STRING,
        enum: [...MENTALITIES],
        format: "enum",
      },
      startingXI: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description: "Exactly 11 player IDs from the provided squad, matching the formation's positional requirements",
      },
      pressing: { type: SchemaType.STRING, enum: [...PRESSINGS], format: "enum" },
      tempo: { type: SchemaType.STRING, enum: [...TEMPOS], format: "enum" },
      width: { type: SchemaType.STRING, enum: [...WIDTHS], format: "enum" },
      reasoning: {
        type: SchemaType.STRING,
        description: "1-3 sentence explanation of the tactical choice, written as the manager's own words.",
      },
    },
    required: ["formation", "mentality", "startingXI", "pressing", "tempo", "width", "reasoning"],
  },
};

/**
 * Generates tactics via Gemini with forced function calling for structured output.
 * Falls back to a safe default formation if the LLM output fails validation
 * (LLM can hallucinate invalid player IDs or malformed formations).
 */
export async function generateTactics(params: GenerateTacticsParams): Promise<TacticsResult> {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your-gemini-api-key-here") {
    console.warn("[ai-agent] GEMINI_API_KEY not set, using fallback tactics");
    return fallbackTactics(params.squad);
  }

  const prompt = buildPrompt(params);

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      tools: [{ functionDeclarations: [SET_TACTICS_FUNCTION] }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingMode.ANY,
          allowedFunctionNames: ["set_tactics"],
        },
      },
    });

    const response = await model.generateContent(prompt);
    const call = response.response.functionCalls()?.[0];

    if (!call || call.name !== "set_tactics") {
      throw new Error("No set_tactics function call in response");
    }

    const raw = call.args as Record<string, unknown>;

    // Flatten Gemini's flat args into our nested TacticsResult shape
    const candidate = {
      formation: raw.formation,
      mentality: raw.mentality,
      startingXI: raw.startingXI,
      instructions: {
        pressing: raw.pressing,
        tempo: raw.tempo,
        width: raw.width,
      },
      reasoning: raw.reasoning,
    };

    const parsed = TacticsSchema.parse(candidate);

    // Validate startingXI against actual squad (LLM can invent IDs)
    const squadIds = new Set(params.squad.map((p) => p.id));
    const invalidIds = parsed.startingXI.filter((id) => !squadIds.has(id));
    if (invalidIds.length > 0) {
      throw new Error(`LLM returned invalid player IDs: ${invalidIds.join(", ")}`);
    }

    // Validate exactly 1 GK in startingXI (critical for match engine)
    const gkCount = params.squad.filter(
      (p) => parsed.startingXI.includes(p.id) && p.position === "GK"
    ).length;
    if (gkCount !== 1) {
      throw new Error(`Invalid squad selection: expected 1 GK, got ${gkCount}`);
    }

    // Validate no duplicates and exactly 11
    if (new Set(parsed.startingXI).size !== 11) {
      throw new Error("startingXI must contain exactly 11 unique player IDs");
    }

    return parsed;
  } catch (err) {
    console.error("[ai-agent] generateTactics failed, using fallback:", err);
    return fallbackTactics(params.squad);
  }
}

function buildPrompt(params: GenerateTacticsParams): string {
  const squadList = params.squad
    .map(
      (p) =>
        `- ${p.id} | ${p.name} | ${p.position} | PAC ${p.pace} SHO ${p.shooting} PAS ${p.passing} DEF ${p.defending} STA ${p.stamina}`
    )
    .join("\n");

  const opponentInfo = params.opponentOverall
    ? `\nOpponent: ${params.opponentName} (Overall ATK ${params.opponentOverall.atk}, MID ${params.opponentOverall.mid}, DEF ${params.opponentOverall.def})`
    : "";

  const contextNote =
    params.context === "SEASON_BASE"
      ? "This is your BASE tactical setup for the season — pick a balanced approach that suits your squad's strengths, since this will be reused across most matches."
      : params.context === "HALF_TIME_ADJUSTMENT"
      ? "It is half-time. Adjust your tactics based on how the first half is likely going given your initial setup and the opponent."
      : "Set your tactics for this specific match, considering the opponent's strengths.";

  return `You are the manager of ${params.teamName}.${opponentInfo}

${contextNote}

Squad (id | name | position | attributes):
${squadList}

Select your formation, starting XI (exactly 11 players, must include exactly 1 GK), mentality, and tactical instructions. Call the set_tactics function with your decision.`;
}

/**
 * Safe fallback: balanced 4-4-2 using best available player per position
 * (sorted by sum of attributes as a rough quality proxy).
 */
function fallbackTactics(squad: GenerateTacticsParams["squad"]): TacticsResult {
  const byPos = (pos: string) =>
    squad.filter((p) => p.position === pos).sort((a, b) => sumAttrs(b) - sumAttrs(a));

  const gk = byPos("GK").slice(0, 1);
  const df = byPos("DF").slice(0, 4);
  const mf = byPos("MF").slice(0, 4);
  const fw = byPos("FW").slice(0, 2);

  // If squad doesn't have enough players per position (e.g. smaller squads),
  // backfill from remaining outfield players to always reach 11.
  let startingXI = [...gk, ...df, ...mf, ...fw];
  if (startingXI.length < 11) {
    const usedIds = new Set(startingXI.map((p) => p.id));
    const remaining = squad
      .filter((p) => !usedIds.has(p.id) && p.position !== "GK")
      .sort((a, b) => sumAttrs(b) - sumAttrs(a));
    startingXI = [...startingXI, ...remaining.slice(0, 11 - startingXI.length)];
  }

  return {
    formation: "4-4-2",
    mentality: "BALANCED",
    startingXI: startingXI.slice(0, 11).map((p) => p.id),
    instructions: { pressing: "MEDIUM", tempo: "NORMAL", width: "NORMAL" },
    reasoning: "Default balanced setup (AI tactics generation unavailable — using fallback).",
  };
}

function sumAttrs(p: GenerateTacticsParams["squad"][number]): number {
  return p.pace + p.shooting + p.passing + p.defending + p.stamina;
}

/**
 * Strips the `reasoning` field to produce a TacticsInput compatible with the match engine.
 */
export function toMatchEngineTactics(result: TacticsResult): TacticsInput {
  const { reasoning, ...tactics } = result;
  return tactics as TacticsInput;
}
