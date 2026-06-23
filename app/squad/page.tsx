"use client";

import AuthWall from "@/components/auth/AuthWall";
import { useAuth } from "@/lib/auth/useAuth";
import { useEffect, useState } from "react";
import { formationToSlots, FORMATIONS } from "@/lib/match-engine/formations";
import type { FormationSlot } from "@/lib/match-engine/formations";

// Label color per position group
const POS_GROUP_COLOR: Record<string, string> = {
  GK: "#ffd700",
  DF: "#4fc3f7",
  MF: "#ce93d8",
  FW: "#ff5252",
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

  const pitchSlots: FormationSlot[] = formationToSlots(
    formation as any,
    "HOME",
  );
  const usedPlayerIds = new Set(slots.values());
  const bench = players.filter((p) => !usedPlayerIds.has(p.id));

  function assignSlot(slotIndex: number) {
    if (!selectedPlayer) return;
    const newSlots = new Map(slots);
    // Remove selected player from any previous slot
    for (const [si, pid] of newSlots.entries()) {
      if (pid === selectedPlayer.id) newSlots.delete(si);
    }
    // Overwrite slot (bumps previous occupant to bench automatically)
    newSlots.set(slotIndex, selectedPlayer.id);
    setSlots(newSlots);
    setSelectedPlayer(null); // clear selection after assignment
  }

  function resetFormation() {
    setSlots(new Map());
    setSelectedPlayer(null);
    setMsg(null);
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
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {team.logoSvg && (
          <div
            style={{ width: 48, flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: team.logoSvg }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow">Your Club</div>
          <h1
            style={{
              fontSize: "clamp(1.2rem, 3vw, 2rem)",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            {team.name}
          </h1>
          <div style={{ color: "var(--ink-dim)", fontSize: 12, marginTop: 2 }}>
            Budget:{" "}
            <span
              style={{ color: "var(--ws-gold)", fontFamily: "var(--mono)" }}
            >
              £{team.budget.toLocaleString()}
            </span>
            {" · "}
            {players.length} Players
          </div>
        </div>

        {/* Controls */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <select
            value={formation}
            onChange={(e) => {
              setFormation(e.target.value);
              setSlots(new Map());
              setSelectedPlayer(null);
            }}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              background: "var(--panel-bg)",
              border: "1px solid var(--border)",
              color: "var(--ink)",
              fontSize: 13,
            }}
          >
            {FORMATIONS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>

          {/* Reset button — poin 2 */}
          <button
            onClick={resetFormation}
            disabled={slots.size === 0}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: slots.size === 0 ? "var(--ink-dim)" : "#ff9800",
              cursor: slots.size === 0 ? "not-allowed" : "pointer",
              fontSize: 12,
              fontFamily: "var(--display)",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            ↺ Reset
          </button>

          <button
            onClick={saveFormation}
            disabled={saving || slots.size !== 11}
            style={{
              padding: "8px 16px",
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
        <div
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            marginBottom: 12,
            fontSize: 13,
            background: msg.startsWith("✓")
              ? "rgba(46,204,113,0.1)"
              : "rgba(255,82,82,0.1)",
            color: msg.startsWith("✓") ? "var(--ws-green-bright)" : "#ff5252",
            border: `1px solid ${msg.startsWith("✓") ? "rgba(46,204,113,0.3)" : "rgba(255,82,82,0.3)"}`,
          }}
        >
          {msg}
        </div>
      )}

      {/* Instruction banner */}
      <div
        style={{
          padding: "8px 14px",
          borderRadius: 6,
          marginBottom: 12,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--border)",
          fontSize: 12,
          color: "var(--ink-dim)",
        }}
      >
        {selectedPlayer ? (
          <span>
            📍 Click any slot to place{" "}
            <strong style={{ color: "var(--ws-gold)" }}>
              {selectedPlayer.name}
            </strong>{" "}
            — or click the same slot again to deselect
          </span>
        ) : (
          <span>
            👆 Select a player from the bench, then click a formation slot to
            assign them
          </span>
        )}
      </div>

      {/* Main grid */}
      <div
        className="squad-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr clamp(240px, 30vw, 320px)",
          gap: 12,
        }}
      >
        {/* PITCH */}
        <div className="panel" style={{ padding: 10 }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "105/68",
              background: "linear-gradient(160deg, #1a5c2e 0%, #14452210 100%)",
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 20px)",
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
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="0.7"
              />
              <line
                x1="52.5"
                y1="3"
                x2="52.5"
                y2="65"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="0.7"
              />
              <circle
                cx="52.5"
                cy="34"
                r="9.15"
                fill="none"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="0.7"
              />
              <circle cx="52.5" cy="34" r="0.5" fill="rgba(255,255,255,0.4)" />
              {/* Home penalty area */}
              <rect
                x="3"
                y="15"
                width="16.5"
                height="38"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="0.6"
              />
              <rect
                x="3"
                y="22.5"
                width="5.5"
                height="23"
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="0.5"
              />
              {/* Away penalty area */}
              <rect
                x="85.5"
                y="15"
                width="16.5"
                height="38"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="0.6"
              />
              <rect
                x="96.5"
                y="22.5"
                width="5.5"
                height="23"
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="0.5"
              />
              {/* Corner arcs */}
              <path
                d="M3,4.5 A1.5,1.5 0 0,1 4.5,3"
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="0.5"
              />
              <path
                d="M100.5,3 A1.5,1.5 0 0,1 102,4.5"
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="0.5"
              />
              <path
                d="M3,63.5 A1.5,1.5 0 0,0 4.5,65"
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="0.5"
              />
              <path
                d="M100.5,65 A1.5,1.5 0 0,0 102,63.5"
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="0.5"
              />
            </svg>

            {/* Formation slots — poin 1 & 3: label with role name */}
            {pitchSlots.map((slot, slotIdx) => {
              const occupantId = slots.get(slotIdx);
              const occupant = players.find((p) => p.id === occupantId);
              const isSelected =
                !!selectedPlayer && occupant?.id === selectedPlayer.id;
              const isTargetable = !!selectedPlayer; // highlight empty slots when player selected

              return (
                <div
                  key={slotIdx}
                  onClick={() => {
                    if (selectedPlayer) {
                      // poin 8: clicking same occupant while selected = deselect (not re-select)
                      if (occupant?.id === selectedPlayer.id) {
                        setSelectedPlayer(null);
                      } else {
                        assignSlot(slotIdx);
                      }
                    } else if (occupant) {
                      setSelectedPlayer(occupant);
                    }
                  }}
                  style={{
                    position: "absolute",
                    left: `${slot.x}%`,
                    top: `${slot.y}%`,
                    transform: "translate(-50%, -50%)",
                    width: 48,
                    height: 56,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                    zIndex: isSelected ? 2 : 1,
                  }}
                >
                  {/* Position label above slot — poin 1 & 3 */}
                  <div
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      color: POS_GROUP_COLOR[slot.posGroup],
                      background: "rgba(0,0,0,0.65)",
                      padding: "1px 4px",
                      borderRadius: 3,
                      textTransform: "uppercase",
                      border: `1px solid ${POS_GROUP_COLOR[slot.posGroup]}44`,
                    }}
                  >
                    {slot.label}
                  </div>

                  {occupant ? (
                    <>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "50%",
                          background: team.jerseyColor,
                          border: isSelected
                            ? "2.5px solid var(--ws-gold)"
                            : "2px solid rgba(255,255,255,0.85)",
                          overflow: "hidden",
                          boxShadow: isSelected
                            ? "0 0 12px rgba(255,215,0,0.6)"
                            : "0 2px 6px rgba(0,0,0,0.5)",
                          flexShrink: 0,
                        }}
                        dangerouslySetInnerHTML={{
                          __html: occupant.avatarSvg ?? "",
                        }}
                      />
                      <span
                        style={{
                          fontSize: 7,
                          color: "#fff",
                          background: "rgba(0,0,0,0.7)",
                          padding: "1px 4px",
                          borderRadius: 2,
                          maxWidth: 46,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {occupant.name.split(" ").slice(-1)[0]}
                      </span>
                    </>
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: isTargetable
                          ? "rgba(255,215,0,0.15)"
                          : "rgba(255,255,255,0.06)",
                        border: isTargetable
                          ? "2px dashed rgba(255,215,0,0.7)"
                          : "2px dashed rgba(255,255,255,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.15s",
                      }}
                    >
                      {isTargetable && (
                        <span
                          style={{
                            color: "rgba(255,215,0,0.8)",
                            fontSize: 14,
                            lineHeight: 1,
                          }}
                        >
                          +
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* BENCH */}
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
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--ink-dim)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Bench — {bench.length}</span>
            <span style={{ color: "var(--ws-gold)" }}>
              {slots.size}/11 placed
            </span>
          </div>
          <div
            className="scroll-thin"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 6,
              maxHeight: "55vh",
            }}
          >
            {bench.length === 0 && (
              <p
                style={{
                  color: "var(--ink-dim)",
                  fontSize: 12,
                  padding: "12px 8px",
                  textAlign: "center",
                }}
              >
                ✓ All players assigned
              </p>
            )}
            {bench.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                selected={selectedPlayer?.id === p.id}
                // poin 8: clicking selected player in bench = deselect
                onClick={() =>
                  setSelectedPlayer(selectedPlayer?.id === p.id ? null : p)
                }
              />
            ))}
          </div>
        </div>
      </div>

      {/* Selected player detail */}
      {selectedPlayer && (
        <div className="panel" style={{ marginTop: 12, padding: 14 }}>
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
        gap: 8,
        padding: "7px 8px",
        borderRadius: 6,
        cursor: "pointer",
        marginBottom: 3,
        background: selected ? "rgba(255,215,0,0.1)" : "transparent",
        border: selected
          ? "1px solid rgba(255,215,0,0.5)"
          : "1px solid transparent",
        transition: "all 0.12s",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
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
        <div style={{ fontSize: 10, color: "var(--ink-dim)" }}>
          <span
            style={{
              padding: "1px 5px",
              borderRadius: 3,
              marginRight: 4,
              background: `${POS_GROUP_COLOR[posGroup(player.position)]}22`,
              color: POS_GROUP_COLOR[posGroup(player.position)],
              fontWeight: 700,
              fontSize: 9,
            }}
          >
            {player.position}
          </span>
          {"★".repeat(player.starRating)}
          {"☆".repeat(5 - player.starRating)}
        </div>
      </div>
      <div
        style={{
          fontSize: 10,
          fontFamily: "var(--mono)",
          color: "var(--ws-gold)",
          textAlign: "right",
          flexShrink: 0,
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
    <div
      style={{
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}
    >
      <div
        style={{ width: 64, flexShrink: 0 }}
        dangerouslySetInnerHTML={{ __html: player.avatarSvg ?? "" }}
      />
      <div style={{ flex: 1, minWidth: 160 }}>
        <div
          style={{
            fontFamily: "var(--display)",
            fontSize: "1.1rem",
            textTransform: "uppercase",
          }}
        >
          {player.name}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-dim)", marginBottom: 8 }}>
          {player.nationality} · {player.age} yrs · {player.position}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {stats.map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: statColor(s.val),
                }}
              >
                {s.val}
              </div>
              <div
                style={{
                  fontSize: 8,
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
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-dim)" }}>
          Value:{" "}
          <span style={{ color: "var(--ws-gold)", fontFamily: "var(--mono)" }}>
            £{player.marketValue.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

function posGroup(pos: string): string {
  if (pos === "GK") return "GK";
  if (pos === "DF") return "DF";
  if (pos === "MF") return "MF";
  return "FW";
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
