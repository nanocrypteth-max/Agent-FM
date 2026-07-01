"use client";

import { useState, useMemo } from "react";

interface PlayerOption {
  id: string;
  name: string;
  position: "GK" | "DF" | "MF" | "FW";
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  stamina: number;
}

const FORMATIONS = [
  "4-4-2",
  "4-3-3",
  "4-2-3-1",
  "3-5-2",
  "5-3-2",
  "4-5-1",
] as const;
const MENTALITIES = ["DEFENSIVE", "BALANCED", "ATTACKING"] as const;
const PRESSINGS = ["LOW", "MEDIUM", "HIGH"] as const;
const TEMPOS = ["SLOW", "NORMAL", "FAST"] as const;
const WIDTHS = ["NARROW", "NORMAL", "WIDE"] as const;

const FORMATION_REQUIREMENTS: Record<
  string,
  { DF: number; MF: number; FW: number }
> = {
  "4-4-2": { DF: 4, MF: 4, FW: 2 },
  "4-3-3": { DF: 4, MF: 3, FW: 3 },
  "4-2-3-1": { DF: 4, MF: 5, FW: 1 },
  "3-5-2": { DF: 3, MF: 5, FW: 2 },
  "5-3-2": { DF: 5, MF: 3, FW: 2 },
  "4-5-1": { DF: 4, MF: 5, FW: 1 },
};

const POS_COLOR: Record<string, string> = {
  GK: "#ffd700",
  DF: "#4fc3f7",
  MF: "#ce93d8",
  FW: "#ff5252",
};

function statColor(v: number) {
  return v >= 80
    ? "#4caf50"
    : v >= 65
      ? "#ffd700"
      : v >= 50
        ? "#ff9800"
        : "#ff5252";
}

// Overall rating proxy — weighted average
function overall(p: PlayerOption) {
  return Math.round(
    (p.pace + p.shooting + p.passing + p.defending + p.stamina) / 5,
  );
}

interface TacticsFormProps {
  fixtureId: string;
  players: PlayerOption[];
  onSubmitted?: () => void;
}

export default function TacticsForm({
  fixtureId,
  players,
  onSubmitted,
}: TacticsFormProps) {
  const [formation, setFormation] =
    useState<(typeof FORMATIONS)[number]>("4-4-2");
  const [mentality, setMentality] =
    useState<(typeof MENTALITIES)[number]>("BALANCED");
  const [pressing, setPressing] =
    useState<(typeof PRESSINGS)[number]>("MEDIUM");
  const [tempo, setTempo] = useState<(typeof TEMPOS)[number]>("NORMAL");
  const [width, setWidth] = useState<(typeof WIDTHS)[number]>("NORMAL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byPosition = useMemo(() => {
    const groups: Record<string, PlayerOption[]> = {
      GK: [],
      DF: [],
      MF: [],
      FW: [],
    };
    for (const p of players) {
      // Sort by overall desc within each position group
      groups[p.position].push(p);
    }
    for (const pos of Object.keys(groups)) {
      groups[pos].sort((a, b) => overall(b) - overall(a));
    }
    return groups;
  }, [players]);

  const requirements = FORMATION_REQUIREMENTS[formation];

  const selectedCounts = useMemo(() => {
    const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
    for (const id of selected) {
      const player = players.find((p) => p.id === id);
      if (player) counts[player.position]++;
    }
    return counts;
  }, [selected, players]);

  const totalSelected = selected.size;
  const isValid =
    totalSelected === 11 &&
    selectedCounts.GK === 1 &&
    selectedCounts.DF === requirements.DF &&
    selectedCounts.MF === requirements.MF &&
    selectedCounts.FW === requirements.FW;

  function toggle(playerId: string, position: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
        return next;
      }
      const limit =
        position === "GK" ? 1 : requirements[position as "DF" | "MF" | "FW"];
      const currentCount = Array.from(next).filter(
        (id) => players.find((p) => p.id === id)?.position === position,
      ).length;
      if (currentCount >= limit || next.size >= 11) return prev;
      next.add(playerId);
      return next;
    });
  }

  async function handleSubmit() {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/fixtures/${fixtureId}/tactics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formation,
          mentality,
          startingXI: Array.from(selected),
          instructions: { pressing, tempo, width },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to submit tactics");
      }
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        color: "var(--ink)",
      }}
    >
      {/* Tactical knobs */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Field label="Formation">
          <select
            value={formation}
            onChange={(e) => {
              setFormation(e.target.value as any);
              setSelected(new Set());
            }}
          >
            {FORMATIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mentality">
          <select
            value={mentality}
            onChange={(e) => setMentality(e.target.value as any)}
          >
            {MENTALITIES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pressing">
          <select
            value={pressing}
            onChange={(e) => setPressing(e.target.value as any)}
          >
            {PRESSINGS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tempo">
          <select
            value={tempo}
            onChange={(e) => setTempo(e.target.value as any)}
          >
            {TEMPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Width">
          <select
            value={width}
            onChange={(e) => setWidth(e.target.value as any)}
          >
            {WIDTHS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Selection counter */}
      <div
        style={{
          fontSize: 12,
          color: "var(--ink-dim)",
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span>
          XI:{" "}
          <strong
            style={{
              color:
                totalSelected === 11
                  ? "var(--ws-green-bright)"
                  : "var(--ws-gold)",
            }}
          >
            {totalSelected}/11
          </strong>
        </span>
        {(["GK", "DF", "MF", "FW"] as const).map((pos) => {
          const need = pos === "GK" ? 1 : requirements[pos];
          const have = selectedCounts[pos];
          return (
            <span
              key={pos}
              style={{
                color:
                  have === need
                    ? "var(--ws-green-bright)"
                    : have > need
                      ? "#ff5252"
                      : "var(--ink-dim)",
              }}
            >
              {pos} {have}/{need}
            </span>
          );
        })}
      </div>

      {/* Player selection — grouped by position with stats */}
      {(["GK", "DF", "MF", "FW"] as const).map((pos) => (
        <div key={pos}>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: POS_COLOR[pos],
              marginBottom: 6,
              fontFamily: "var(--display)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: POS_COLOR[pos],
                display: "inline-block",
              }}
            />
            {pos} — {pos === "GK" ? "1" : requirements[pos]} needed
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {byPosition[pos].map((p) => {
              const isSelected = selected.has(p.id);
              const ov = overall(p);
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id, p.position)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "32px 1fr auto",
                    gap: 10,
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: isSelected
                      ? `1px solid ${POS_COLOR[pos]}88`
                      : "1px solid var(--border)",
                    background: isSelected
                      ? `${POS_COLOR[pos]}12`
                      : "var(--panel-bg)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.1s",
                  }}
                >
                  {/* Overall rating */}
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 14,
                      fontWeight: 700,
                      color: statColor(ov),
                      textAlign: "center",
                    }}
                  >
                    {ov}
                  </div>

                  {/* Name */}
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? "var(--ink)" : "var(--ink-dim)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </div>

                  {/* Stats mini row */}
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {(
                      [
                        ["PAC", p.pace],
                        ["SHO", p.shooting],
                        ["PAS", p.passing],
                        ["DEF", p.defending],
                        ["STA", p.stamina],
                      ] as [string, number][]
                    ).map(([label, val]) => (
                      <div
                        key={label}
                        style={{ textAlign: "center", minWidth: 28 }}
                      >
                        <div
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 12,
                            fontWeight: 700,
                            color: statColor(val),
                          }}
                        >
                          {val}
                        </div>
                        <div
                          style={{
                            fontSize: 8,
                            color: "var(--ink-dim)",
                            textTransform: "uppercase",
                          }}
                        >
                          {label}
                        </div>
                      </div>
                    ))}
                    {isSelected && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          paddingLeft: 4,
                        }}
                      >
                        <span style={{ color: POS_COLOR[pos], fontSize: 14 }}>
                          ✓
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {error && (
        <p style={{ color: "var(--home-color)", fontSize: 13 }}>{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!isValid || submitting}
        style={{
          padding: "12px 28px",
          borderRadius: 6,
          border: "none",
          background: isValid ? "var(--accent)" : "var(--border)",
          color: isValid ? "var(--bg)" : "var(--ink-dim)",
          fontWeight: 700,
          fontFamily: "var(--display)",
          textTransform: "uppercase",
          letterSpacing: 1.5,
          fontSize: 13,
          cursor: isValid ? "pointer" : "not-allowed",
          alignSelf: "flex-start",
        }}
      >
        {submitting ? "Submitting..." : "Confirm Tactics"}
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontSize: 12,
        color: "var(--ink-dim)",
      }}
    >
      {label}
      {children}
    </label>
  );
}
