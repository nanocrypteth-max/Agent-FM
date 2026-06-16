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

const FORMATIONS = ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "5-3-2", "4-5-1"] as const;
const MENTALITIES = ["DEFENSIVE", "BALANCED", "ATTACKING"] as const;
const PRESSINGS = ["LOW", "MEDIUM", "HIGH"] as const;
const TEMPOS = ["SLOW", "NORMAL", "FAST"] as const;
const WIDTHS = ["NARROW", "NORMAL", "WIDE"] as const;

// Required position counts per formation (excluding GK, which is always 1)
const FORMATION_REQUIREMENTS: Record<string, { DF: number; MF: number; FW: number }> = {
  "4-4-2": { DF: 4, MF: 4, FW: 2 },
  "4-3-3": { DF: 4, MF: 3, FW: 3 },
  "4-2-3-1": { DF: 4, MF: 5, FW: 1 }, // 2 CDM + 3 AM counted as MF
  "3-5-2": { DF: 3, MF: 5, FW: 2 },
  "5-3-2": { DF: 5, MF: 3, FW: 2 },
  "4-5-1": { DF: 4, MF: 5, FW: 1 },
};

interface TacticsFormProps {
  fixtureId: string;
  players: PlayerOption[];
  onSubmitted?: () => void;
}

export default function TacticsForm({ fixtureId, players, onSubmitted }: TacticsFormProps) {
  const [formation, setFormation] = useState<typeof FORMATIONS[number]>("4-4-2");
  const [mentality, setMentality] = useState<typeof MENTALITIES[number]>("BALANCED");
  const [pressing, setPressing] = useState<typeof PRESSINGS[number]>("MEDIUM");
  const [tempo, setTempo] = useState<typeof TEMPOS[number]>("NORMAL");
  const [width, setWidth] = useState<typeof WIDTHS[number]>("NORMAL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byPosition = useMemo(() => {
    const groups: Record<string, PlayerOption[]> = { GK: [], DF: [], MF: [], FW: [] };
    for (const p of players) groups[p.position].push(p);
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

      // Enforce position limits while selecting
      const limit = position === "GK" ? 1 : requirements[position as "DF" | "MF" | "FW"];
      const currentCount = Array.from(next).filter(
        (id) => players.find((p) => p.id === id)?.position === position
      ).length;

      if (currentCount >= limit) {
        return prev; // ignore — limit reached for this position
      }

      if (next.size >= 11) return prev; // overall cap

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
    <div style={{ display: "flex", flexDirection: "column", gap: 16, color: "var(--ink)" }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Field label="Formation">
          <select value={formation} onChange={(e) => { setFormation(e.target.value as any); setSelected(new Set()); }}>
            {FORMATIONS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Mentality">
          <select value={mentality} onChange={(e) => setMentality(e.target.value as any)}>
            {MENTALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Pressing">
          <select value={pressing} onChange={(e) => setPressing(e.target.value as any)}>
            {PRESSINGS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Tempo">
          <select value={tempo} onChange={(e) => setTempo(e.target.value as any)}>
            {TEMPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Width">
          <select value={width} onChange={(e) => setWidth(e.target.value as any)}>
            {WIDTHS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </Field>
      </div>

      <div>
        <p style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 8 }}>
          Starting XI: {totalSelected}/11 — GK {selectedCounts.GK}/1, DF {selectedCounts.DF}/{requirements.DF}, MF{" "}
          {selectedCounts.MF}/{requirements.MF}, FW {selectedCounts.FW}/{requirements.FW}
        </p>

        {(["GK", "DF", "MF", "FW"] as const).map((pos) => (
          <div key={pos} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "var(--ink-dim)", marginBottom: 4 }}>
              {pos}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {byPosition[pos].map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id, p.position)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 4,
                    border: selected.has(p.id) ? "1px solid var(--accent)" : "1px solid var(--border)",
                    background: selected.has(p.id) ? "rgba(255,209,102,0.12)" : "var(--panel-bg-2)",
                    color: selected.has(p.id) ? "var(--accent)" : "var(--ink)",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <p style={{ color: "var(--home-color)", fontSize: 13 }}>{error}</p>}

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--ink-dim)" }}>
      {label}
      {children}
    </label>
  );
}
