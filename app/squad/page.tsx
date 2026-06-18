"use client";

import AuthWall from "@/components/auth/AuthWall";
import { useAuth } from "@/lib/auth/useAuth";
import { useEffect, useState, useMemo } from "react";
import { formationToSlots } from "@/lib/match-engine/formations";

const FORMATIONS = [
  "4-4-2",
  "4-3-3",
  "4-2-3-1",
  "3-5-2",
  "5-3-2",
  "4-5-1",
] as const;

const POSITION_REQ: Record<
  string,
  { GK: number; DF: number; MF: number; FW: number }
> = {
  "4-4-2": { GK: 1, DF: 4, MF: 4, FW: 2 },
  "4-3-3": { GK: 1, DF: 4, MF: 3, FW: 3 },
  "4-2-3-1": { GK: 1, DF: 4, MF: 5, FW: 1 },
  "3-5-2": { GK: 1, DF: 3, MF: 5, FW: 2 },
  "5-3-2": { GK: 1, DF: 5, MF: 3, FW: 2 },
  "4-5-1": { GK: 1, DF: 4, MF: 5, FW: 1 },
};

interface Player {
  id: string;
  name: string;
  position: string;
  starRating: number;
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  stamina: number;
  avatarSvg: string;
  marketValue: number;
  age: number;
  nationality: string;
  slotIndex: number | null;
}

interface TeamInfo {
  id: string;
  name: string;
  budget: number;
  jerseyColor: string;
  logoSvg: string;
  formation: string;
}

export default function SquadPage() {
  return (
    <AuthWall>
      <SquadContent />
    </AuthWall>
  );
}

function SquadContent() {
  const { walletAddress } = useAuth();
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [formation, setFormation] = useState<string>("4-4-2");
  const [slots, setSlots] = useState<Map<number, string>>(new Map());
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) return;

    fetch(`/api/squad?wallet=${walletAddress}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.team || !data.players) return;
        setTeam(data.team);
        setPlayers(data.players ?? []);
        setFormation(data.team.formation || "4-4-2");
        const map = new Map<number, string>();
        (data.players ?? []).forEach((p: Player) => {
          if (p.slotIndex !== null) map.set(p.slotIndex, p.id);
        });
        setSlots(map);
      })
      .catch(() => {});
  }, [walletAddress]);

  const pitchSlots = formationToSlots(formation as any, "HOME");
  const req = POSITION_REQ[formation] ?? POSITION_REQ["4-4-2"];

  const usedPlayerIds = new Set(slots.values());
  const bench = players.filter((p) => !usedPlayerIds.has(p.id));

  function assignSlot(slotIndex: number) {
    if (!selectedPlayer) return;
    // Remove player from any existing slot
    const newSlots = new Map(slots);
    for (const [si, pid] of newSlots.entries()) {
      if (pid === selectedPlayer.id) newSlots.delete(si);
    }
    // If slot already occupied, send that player to bench (remove from slot)
    newSlots.set(slotIndex, selectedPlayer.id);
    setSlots(newSlots);
    setSelectedPlayer(null);
  }

  async function saveFormation() {
    setSaving(true);
    setMsg(null);
    const slotsArray = Array.from(slots.entries()).map(
      ([slotIndex, playerId]) => ({ slotIndex, playerId }),
    );
    const res = await fetch("/api/squad/formation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formation, slots: slotsArray }),
    });
    const data = await res.json();
    setSaving(false);
    setMsg(res.ok ? "✓ Formation saved!" : data.error);
  }

  if (!team) return <Centered>Loading squad...</Centered>;

  return (
    <div className="page">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 24,
        }}
      >
        {team.logoSvg && (
          <div
            style={{ width: 56, height: 64, flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: team.logoSvg }}
          />
        )}
        <div>
          <div className="eyebrow">Your Club</div>
          <h1
            style={{ fontSize: "2rem", textTransform: "uppercase", margin: 0 }}
          >
            {team.name}
          </h1>
          <div style={{ color: "var(--ink-dim)", fontSize: 13, marginTop: 2 }}>
            Budget:{" "}
            <span
              style={{ color: "var(--ws-gold)", fontFamily: "var(--mono)" }}
            >
              £{team.budget.toLocaleString()}
            </span>{" "}
            · {players.length} Players in Squad
          </div>
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <select
            value={formation}
            onChange={(e) => {
              setFormation(e.target.value);
              setSlots(new Map());
            }}
          >
            {FORMATIONS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <button
            onClick={saveFormation}
            disabled={saving || slots.size !== 11}
            style={{
              padding: "10px 20px",
              borderRadius: 6,
              border: "none",
              background:
                slots.size === 11 ? "var(--ws-gold)" : "var(--border)",
              color: slots.size === 11 ? "#0a0d12" : "var(--ink-dim)",
              fontFamily: "var(--display)",
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: 1,
              cursor: slots.size === 11 ? "pointer" : "not-allowed",
              fontWeight: 700,
            }}
          >
            {saving ? "Saving..." : `Save (${slots.size}/11)`}
          </button>
        </div>
      </div>
      {msg && (
        <p
          style={{
            color: msg.startsWith("✓")
              ? "var(--ws-green-bright)"
              : "var(--home-color)",
            marginBottom: 12,
          }}
        >
          {msg}
        </p>
      )}

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}
      >
        {/* PITCH */}
        <div className="panel" style={{ padding: 12 }}>
          <div
            style={{
              color: "var(--ink-dim)",
              fontSize: 12,
              fontFamily: "var(--display)",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            {selectedPlayer
              ? `Click a slot to place ${selectedPlayer.name}`
              : "Click a player below, then click a slot to assign"}
          </div>
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "105/68",
              background: "linear-gradient(180deg, #1e5631 0%, #184a28 100%)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            {/* Pitch markings */}
            <svg
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}
              viewBox="0 0 105 68"
            >
              <rect
                x="3"
                y="3"
                width="99"
                height="62"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="0.8"
              />
              <line
                x1="52.5"
                y1="3"
                x2="52.5"
                y2="65"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="0.8"
              />
              <circle
                cx="52.5"
                cy="34"
                r="9.15"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="0.8"
              />
              <rect
                x="3"
                y="19"
                width="16.5"
                height="30"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="0.6"
              />
              <rect
                x="85.5"
                y="19"
                width="16.5"
                height="30"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="0.6"
              />
            </svg>
            {/* Formation slots */}
            {pitchSlots.map((pos, slotIdx) => {
              const occupantId = slots.get(slotIdx);
              const occupant = players.find((p) => p.id === occupantId);
              const isEmpty = !occupant;
              return (
                <div
                  key={slotIdx}
                  onClick={() =>
                    isEmpty
                      ? selectedPlayer && assignSlot(slotIdx)
                      : setSelectedPlayer(occupant!)
                  }
                  style={{
                    position: "absolute",
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: "translate(-50%, -50%)",
                    width: 44,
                    height: 44,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  {occupant ? (
                    <>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: team.jerseyColor,
                          border:
                            selectedPlayer?.id === occupant.id
                              ? "2px solid var(--ws-gold)"
                              : "2px solid rgba(255,255,255,0.8)",
                          overflow: "hidden",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                        }}
                        dangerouslySetInnerHTML={{
                          __html: occupant.avatarSvg ?? "",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "6px",
                          color: "#fff",
                          background: "rgba(0,0,0,0.6)",
                          padding: "1px 3px",
                          borderRadius: 2,
                          maxWidth: 44,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {occupant.name.split(" ").pop()}
                      </span>
                    </>
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: selectedPlayer
                          ? "rgba(255,215,0,0.2)"
                          : "rgba(255,255,255,0.1)",
                        border: selectedPlayer
                          ? "2px dashed var(--ws-gold)"
                          : "2px dashed rgba(255,255,255,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                      }}
                    >
                      {selectedPlayer ? "+" : "·"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* BENCH / SQUAD LIST */}
        <div
          className="panel"
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--border)",
              fontFamily: "var(--display)",
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--ink-dim)",
            }}
          >
            Bench — {bench.length} Players
          </div>
          <div
            className="scroll-thin"
            style={{ flex: 1, overflowY: "auto", padding: 8, maxHeight: 520 }}
          >
            {bench.length === 0 && (
              <p style={{ color: "var(--ink-dim)", fontSize: 13, padding: 8 }}>
                All players assigned to formation.
              </p>
            )}
            {bench.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                selected={selectedPlayer?.id === p.id}
                onClick={() =>
                  setSelectedPlayer(selectedPlayer?.id === p.id ? null : p)
                }
              />
            ))}
          </div>
        </div>
      </div>

      {/* Full squad at bottom */}
      {selectedPlayer && (
        <div className="panel" style={{ marginTop: 16, padding: 14 }}>
          <PlayerDetailCard
            player={selectedPlayer}
            jerseyColor={team.jerseyColor}
          />
        </div>
      )}
    </div>
  );
}

function PlayerCard({
  player,
  selected,
  onClick,
}: {
  player: Player;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 6,
        cursor: "pointer",
        marginBottom: 4,
        background: selected ? "rgba(255,215,0,0.1)" : "transparent",
        border: selected
          ? "1px solid rgba(255,215,0,0.4)"
          : "1px solid transparent",
        transition: "all 0.15s",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: "50%",
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}
        dangerouslySetInnerHTML={{ __html: player.avatarSvg ?? "" }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {player.name}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>
          {player.position} · {"★".repeat(player.starRating)}
          {"☆".repeat(5 - player.starRating)}
        </div>
      </div>
      <div
        style={{
          fontSize: 11,
          fontFamily: "var(--mono)",
          color: "var(--ws-gold)",
          textAlign: "right",
        }}
      >
        {player.pace}/{player.shooting}/{player.passing}
      </div>
    </div>
  );
}

function PlayerDetailCard({
  player,
  jerseyColor,
}: {
  player: Player;
  jerseyColor: string;
}) {
  const stats = [
    { label: "PAC", val: player.pace },
    { label: "SHO", val: player.shooting },
    { label: "PAS", val: player.passing },
    { label: "DEF", val: player.defending },
    { label: "STA", val: player.stamina },
  ];
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div
        style={{ width: 80, flexShrink: 0 }}
        dangerouslySetInnerHTML={{ __html: player.avatarSvg ?? "" }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: "var(--display)",
            fontSize: "1.2rem",
            textTransform: "uppercase",
          }}
        >
          {player.name}
        </div>
        <div
          style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 10 }}
        >
          {player.nationality} · {player.age} yrs · {player.position}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {stats.map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: statColor(s.val),
                }}
              >
                {s.val}
              </div>
              <div
                style={{
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "var(--ink-dim)",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-dim)" }}>
          Market Value:{" "}
          <span style={{ color: "var(--ws-gold)", fontFamily: "var(--mono)" }}>
            £{player.marketValue.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

function statColor(val: number): string {
  if (val >= 80) return "#4caf50";
  if (val >= 65) return "#ffd700";
  if (val >= 50) return "#ff9800";
  return "#ff5252";
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
