"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import AuthWall from "@/components/auth/AuthWall";
import { levelProgress, trainingGainRange } from "@/lib/exp/manager";

interface TrainingPlayer {
  id: string;
  name: string;
  position: string;
  starRating: number;
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  stamina: number;
  playerExp: number;
  playerLevel: number;
  avatarSvg: string | null;
  canTrainToday: boolean;
}

export default function TrainPage() {
  return <AuthWall><TrainContent /></AuthWall>;
}

function TrainContent() {
  const { session, walletAddress } = useAuth();
  const [players, setPlayers] = useState<TrainingPlayer[]>([]);
  const [managerLevel, setManagerLevel] = useState(1);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState<string | null>(null);
  const [result, setResult] = useState<{ playerId: string; stat: string; gain: number; newValue: number } | null>(null);
  const [nextReset, setNextReset] = useState<string>("");

  useEffect(() => {
    if (walletAddress) loadTraining();
  }, [walletAddress]);

  async function loadTraining() {
    setLoading(true);
    const res = await fetch(`/api/train?wallet=${walletAddress}`);
    if (res.ok) {
      const data = await res.json();
      setPlayers(data.players);
      setManagerLevel(data.managerLevel);
      setNextReset(data.nextResetAt);
    }
    setLoading(false);
  }

  async function handleTrain(playerId: string) {
    setTraining(playerId);
    setResult(null);
    const res = await fetch("/api/train", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solanaWallet: walletAddress, playerId }),
    });
    const data = await res.json();
    if (res.ok) {
      setResult({ playerId, ...data });
      // Update player in list
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === playerId
            ? { ...p, [data.stat]: data.newValue, canTrainToday: false, playerExp: data.playerExp, playerLevel: data.playerLevel }
            : p
        )
      );
    }
    setTraining(null);
  }

  const { min, max } = trainingGainRange(managerLevel);
  const resetTime = nextReset ? new Date(nextReset).toLocaleTimeString() : "";

  if (loading) return <Centered>Loading training...</Centered>;

  return (
    <div className="page">
      <div className="ws-hero" style={{ marginBottom: 20 }}>
        <div className="ws-badge"><span className="pulse-ball" />Training Ground</div>
        <h1 className="ws-title">Player Training</h1>
        <p className="ws-subtitle">
          Train each player once per day. Stat gains depend on your manager level.
          Resets at midnight UTC ({resetTime} your time).
        </p>
      </div>

      {/* Manager level info */}
      {session && (
        <div className="panel" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", gap: 24, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--ink-dim)", textTransform: "uppercase", letterSpacing: 1 }}>Manager Level</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: "1.4rem", fontWeight: 700, color: "var(--ws-gold)" }}>
              LV {session.managerLevel}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11, color: "var(--ink-dim)" }}>
              <span>{session.managerExp} EXP</span>
              <span>{levelProgress(session.managerExp, session.managerLevel).expToNext} to next level</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${levelProgress(session.managerExp, session.managerLevel).progressPercent}%`,
                background: "linear-gradient(90deg, var(--ws-gold-dim), var(--ws-gold))",
                borderRadius: 3,
                transition: "width 0.5s ease",
              }} />
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "var(--ink-dim)" }}>
            Training gain: <span style={{ color: "var(--ws-green-bright)" }}>+{min} to +{max}</span>
          </div>
        </div>
      )}

      {/* Result flash */}
      {result && (
        <div style={{
          padding: "12px 16px", marginBottom: 16, borderRadius: 8,
          background: "rgba(46,204,113,0.1)", border: "1px solid var(--ws-green-bright)",
          fontSize: 14, color: "var(--ws-green-bright)",
        }}>
          🎯 {players.find((p) => p.id === result.playerId)?.name} — {result.stat.toUpperCase()}{" "}
          {result.gain > 0 ? `+${result.gain} (now ${result.newValue})` : "already maxed at 99!"}
        </div>
      )}

      {/* Player grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {players.map((p) => (
          <TrainingCard
            key={p.id}
            player={p}
            onTrain={() => handleTrain(p.id)}
            training={training === p.id}
          />
        ))}
      </div>
    </div>
  );
}

function TrainingCard({ player: p, onTrain, training }: {
  player: TrainingPlayer;
  onTrain: () => void;
  training: boolean;
}) {
  const stats = [
    { label: "PAC", val: p.pace },
    { label: "SHO", val: p.shooting },
    { label: "PAS", val: p.passing },
    { label: "DEF", val: p.defending },
    { label: "STA", val: p.stamina },
  ];

  return (
    <div className="panel" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 14px 8px", display: "flex", gap: 12, alignItems: "flex-start" }}>
        {p.avatarSvg && (
          <div style={{ width: 56, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: p.avatarSvg }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--display)", fontSize: "0.95rem", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.name}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: posBg(p.position), color: "#0a0d12", fontWeight: 700 }}>
              {p.position}
            </span>
            <span style={{ fontSize: 11, color: "var(--ws-gold)" }}>
              {"★".repeat(p.starRating)}
            </span>
          </div>
          <div style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 4 }}>
            Player LV {p.playerLevel} · {p.playerExp} EXP
          </div>
        </div>
      </div>

      <div style={{ display: "flex", padding: "8px 14px", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        {stats.map((s) => (
          <div key={s.label} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 700, color: statColor(s.val) }}>{s.val}</div>
            <div style={{ fontSize: 8, color: "var(--ink-dim)", textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "10px 14px" }}>
        {p.canTrainToday ? (
          <button
            onClick={onTrain}
            disabled={training}
            style={{
              width: "100%", padding: "9px", borderRadius: 6, border: "none",
              background: training ? "var(--border)" : "var(--ws-gold)",
              color: training ? "var(--ink-dim)" : "#0a0d12",
              fontFamily: "var(--display)", fontWeight: 700,
              fontSize: 12, textTransform: "uppercase", letterSpacing: 1,
              cursor: training ? "not-allowed" : "pointer",
            }}
          >
            {training ? "Training..." : "⚡ Train Now"}
          </button>
        ) : (
          <div style={{
            textAlign: "center", padding: "8px", fontSize: 11,
            color: "var(--ink-dim)", background: "var(--panel-bg)",
            borderRadius: 6, border: "1px solid var(--border)",
          }}>
            ✓ Trained today · Resets midnight UTC
          </div>
        )}
      </div>
    </div>
  );
}

function posBg(pos: string): string {
  return { GK: "#ffd700", DF: "#4fc3f7", MF: "#ce93d8", FW: "#ff5252" }[pos] ?? "#888";
}

function statColor(v: number): string {
  return v >= 80 ? "#4caf50" : v >= 65 ? "#ffd700" : v >= 50 ? "#ff9800" : "#ff5252";
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--ink)" }}>{children}</div>;
}
