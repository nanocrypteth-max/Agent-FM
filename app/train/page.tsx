"use client";

import { useEffect, useState, useCallback } from "react";
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
}

/** Returns HH:MM:SS countdown string until a target ISO datetime */
function useCountdown(targetIso: string): string {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (!targetIso) return;

    function update() {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) {
        setDisplay("00:00:00");
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setDisplay(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );
    }

    update();
    const id = setInterval(update, 1_000);
    return () => clearInterval(id);
  }, [targetIso]);

  return display;
}

export default function TrainPage() {
  return (
    <AuthWall>
      <TrainContent />
    </AuthWall>
  );
}

function TrainContent() {
  const { session, walletAddress } = useAuth();
  const [players, setPlayers] = useState<TrainingPlayer[]>([]);
  const [managerLevel, setManagerLevel] = useState(1);
  const [managerExp, setManagerExp] = useState(0);
  const [clubCanTrain, setClubCanTrain] = useState(true);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState<string | null>(null);
  const [result, setResult] = useState<{
    playerId: string;
    stat: string;
    gain: number;
    newValue: number;
  } | null>(null);
  const [nextReset, setNextReset] = useState<string>("");

  const countdown = useCountdown(nextReset);

  useEffect(() => {
    if (walletAddress) loadTraining();
  }, [walletAddress]);

  // Auto-refresh when cooldown expires so UI unlocks without manual refresh
  useEffect(() => {
    if (!nextReset || clubCanTrain) return;
    const diff = new Date(nextReset).getTime() - Date.now();
    if (diff <= 0) return;
    const id = setTimeout(() => {
      loadTraining();
    }, diff + 1000); // +1s buffer
    return () => clearTimeout(id);
  }, [nextReset, clubCanTrain]);

  async function loadTraining() {
    setLoading(true);
    const res = await fetch(`/api/train?wallet=${walletAddress}`);
    if (res.ok) {
      const data = await res.json();
      setPlayers(data.players);
      setManagerLevel(data.managerLevel);
      setManagerExp(data.managerExp ?? 0);
      setClubCanTrain(data.clubCanTrainToday);
      setNextReset(data.nextResetAt);
    }
    setLoading(false);
  }

  async function handleBoost(playerId: string) {
    if (!walletAddress) return;
    const BOOST_SOL = 0.01;
    const TREASURY = process.env.NEXT_PUBLIC_SOLANA_TREASURY;
    if (!TREASURY) {
      alert("Treasury not configured");
      return;
    }

    // Get wallet for signing
    const phantom = (window as any).phantom?.solana ?? (window as any).solana;
    const signer = phantom?.isPhantom ? phantom : null;
    if (!signer) {
      alert("Wallet not connected");
      return;
    }

    setTraining(`boost-${playerId}`);
    try {
      const { Connection, PublicKey, Transaction, SystemProgram } =
        await import("@solana/web3.js");
      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
          "https://api.devnet.solana.com",
        "confirmed",
      );
      const lamports = Math.round(BOOST_SOL * 1_000_000_000);

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(walletAddress),
          toPubkey: new PublicKey(TREASURY),
          lamports,
        }),
      );
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(walletAddress);

      const { signature } = await signer.signAndSendTransaction(tx);

      const res = await fetch("/api/train/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solanaWallet: walletAddress,
          playerId,
          txHash: signature,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({
          playerId,
          stat: data.stat,
          gain: data.gain,
          newValue: data.newValue,
        });
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === playerId ? { ...p, [data.stat]: data.newValue } : p,
          ),
        );
      } else {
        alert(data.error);
      }
    } catch (e: any) {
      alert(e?.message ?? "Boost failed");
    }
    setTraining(null);
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
      setClubCanTrain(false); // club used daily training slot
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === playerId
            ? {
                ...p,
                [data.stat]: data.newValue,
                playerExp: data.playerExp,
                playerLevel: data.playerLevel,
              }
            : p,
        ),
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
        <div className="ws-badge">
          <span className="pulse-ball" />
          Training Ground
        </div>
        <h1 className="ws-title">Player Training</h1>
        <p className="ws-subtitle">
          Train each player once per day. Stat gains depend on your manager
          level. Resets at midnight UTC each day.
        </p>
      </div>

      {/* Manager level info */}
      {session && (
        <div
          className="panel"
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            display: "flex",
            gap: 24,
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-dim)",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Manager Level
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "1.4rem",
                fontWeight: 700,
                color: "var(--ws-gold)",
              }}
            >
              LV {session.managerLevel}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
                fontSize: 11,
                color: "var(--ink-dim)",
              }}
            >
              <span>{session.managerExp} EXP</span>
              <span>
                {
                  levelProgress(session.managerExp, session.managerLevel)
                    .expToNext
                }{" "}
                to next level
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: "var(--border)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${levelProgress(session.managerExp, session.managerLevel).progressPercent}%`,
                  background:
                    "linear-gradient(90deg, var(--ws-gold-dim), var(--ws-gold))",
                  borderRadius: 3,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>
          <div
            style={{
              textAlign: "right",
              fontSize: 12,
              color: "var(--ink-dim)",
            }}
          >
            Training gain:{" "}
            <span style={{ color: "var(--ws-green-bright)" }}>
              +{min} to +{max}
            </span>
          </div>
        </div>
      )}

      {/* Club training status banner */}
      {!clubCanTrain ? (
        <div
          style={{
            padding: "16px 20px",
            marginBottom: 16,
            borderRadius: 8,
            background: "rgba(255,152,0,0.08)",
            border: "1px solid rgba(255,152,0,0.4)",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span style={{ fontSize: 28 }}>🏋️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#ff9800" }}>
              Club has trained today
            </div>
            <div
              style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2 }}
            >
              Daily training slot used. Next session available in:
            </div>
          </div>
          {/* Countdown timer */}
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: "1.6rem",
              fontWeight: 700,
              color: "#ff9800",
              letterSpacing: 2,
              background: "rgba(255,152,0,0.12)",
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid rgba(255,152,0,0.3)",
              minWidth: 120,
              textAlign: "center",
            }}
          >
            {countdown || "00:00:00"}
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: "14px 18px",
            marginBottom: 16,
            borderRadius: 8,
            background: "rgba(46,204,113,0.08)",
            border: "1px solid rgba(46,204,113,0.3)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 24 }}>⚡</span>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--ws-green-bright)",
              }}
            >
              Training available
            </div>
            <div
              style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2 }}
            >
              Choose 1 player to train today. Only 1 session per day — choose
              wisely.
            </div>
          </div>
        </div>
      )}

      {/* Result flash */}
      {result && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            borderRadius: 8,
            background: "rgba(46,204,113,0.1)",
            border: "1px solid var(--ws-green-bright)",
            fontSize: 14,
            color: "var(--ws-green-bright)",
          }}
        >
          🎯 {players.find((p) => p.id === result.playerId)?.name} —{" "}
          {result.stat.toUpperCase()}{" "}
          {result.gain > 0
            ? `+${result.gain} (now ${result.newValue})`
            : "already maxed at 99!"}
        </div>
      )}

      {/* Player grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 14,
        }}
      >
        {players.map((p) => (
          <TrainingCard
            key={p.id}
            player={p}
            onTrain={() => handleTrain(p.id)}
            onBoost={() => handleBoost(p.id)}
            training={training === p.id || training === `boost-${p.id}`}
            clubCanTrain={clubCanTrain}
          />
        ))}
      </div>
    </div>
  );
}

function TrainingCard({
  player: p,
  onTrain,
  onBoost,
  training,
  clubCanTrain,
}: {
  player: TrainingPlayer;
  onTrain: () => void;
  onBoost: () => void;
  training: boolean;
  clubCanTrain: boolean;
}) {
  const stats = [
    { label: "PAC", val: p.pace },
    { label: "SHO", val: p.shooting },
    { label: "PAS", val: p.passing },
    { label: "DEF", val: p.defending },
    { label: "STA", val: p.stamina },
  ];

  return (
    <div
      className="panel"
      style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <div
        style={{
          padding: "14px 14px 8px",
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        {p.avatarSvg && (
          <div
            style={{ width: 56, flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: p.avatarSvg }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--display)",
              fontSize: "0.95rem",
              textTransform: "uppercase",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {p.name}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 3,
                background: posBg(p.position),
                color: "#0a0d12",
                fontWeight: 700,
              }}
            >
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

      <div
        style={{
          display: "flex",
          padding: "8px 14px",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {stats.map((s) => (
          <div key={s.label} style={{ flex: 1, textAlign: "center" }}>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 14,
                fontWeight: 700,
                color: statColor(s.val),
              }}
            >
              {s.val}
            </div>
            <div
              style={{
                fontSize: 8,
                color: "var(--ink-dim)",
                textTransform: "uppercase",
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {clubCanTrain ? (
          <button
            onClick={onTrain}
            disabled={training}
            style={{
              width: "100%",
              padding: "9px",
              borderRadius: 6,
              border: "none",
              background: training ? "var(--border)" : "var(--ws-gold)",
              color: training ? "var(--ink-dim)" : "#0a0d12",
              fontFamily: "var(--display)",
              fontWeight: 700,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 1,
              cursor: training ? "not-allowed" : "pointer",
            }}
          >
            {training ? "Training..." : "⚡ Train This Player"}
          </button>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "8px",
              fontSize: 11,
              color: "var(--ink-dim)",
              background: "var(--panel-bg)",
              borderRadius: 6,
              border: "1px solid var(--border)",
            }}
          >
            Club trained today
          </div>
        )}
        {/* Boost button — always available, costs 0.01 SOL */}
        <button
          onClick={onBoost}
          disabled={training}
          style={{
            width: "100%",
            padding: "7px",
            borderRadius: 6,
            border: "1px solid rgba(153,69,255,0.4)",
            background: "rgba(153,69,255,0.08)",
            color: "#9945FF",
            fontFamily: "var(--display)",
            fontWeight: 700,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 1,
            cursor: training ? "not-allowed" : "pointer",
          }}
        >
          {training ? "..." : "⚡ Boost (0.01 SOL)"}
        </button>
      </div>
    </div>
  );
}

function posBg(pos: string): string {
  return (
    { GK: "#ffd700", DF: "#4fc3f7", MF: "#ce93d8", FW: "#ff5252" }[pos] ??
    "#888"
  );
}

function statColor(v: number): string {
  return v >= 80
    ? "#4caf50"
    : v >= 65
      ? "#ffd700"
      : v >= 50
        ? "#ff9800"
        : "#ff5252";
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "60vh",
        color: "var(--ink)",
      }}
    >
      {children}
    </div>
  );
}
