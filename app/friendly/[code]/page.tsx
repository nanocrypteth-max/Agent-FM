"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import AuthWall from "@/components/auth/AuthWall";
import PitchView from "@/components/pitch/PitchView";
import { formationToSlots, FORMATIONS } from "@/lib/match-engine/formations";
import type { MatchEvent } from "@/lib/match-engine/types";
import type { FormationSlot } from "@/lib/match-engine/formations";

interface LobbyData {
  id: string;
  code: string;
  status: string;
  hostTeamId: string;
  guestTeamId: string | null;
  hostReady: boolean;
  guestReady: boolean;
  hostTeam: {
    id: string;
    name: string;
    logoSvg: string | null;
    jerseyColor: string;
  };
  guestTeam: {
    id: string;
    name: string;
    logoSvg: string | null;
    jerseyColor: string;
  } | null;
  matchResult: any | null;
}

interface SquadPlayer {
  id: string;
  name: string;
  position: string;
  starRating: number;
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  stamina: number;
  avatarSvg: string | null;
  slotIndex: number | null;
}

const POS_COLOR: Record<string, string> = {
  GK: "#ffd700",
  DF: "#4fc3f7",
  MF: "#ce93d8",
  FW: "#ff5252",
};

export default function FriendlyRoomPage() {
  return (
    <AuthWall>
      <FriendlyRoom />
    </AuthWall>
  );
}

function FriendlyRoom() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();
  const { walletAddress, session } = useAuth();

  // Lobby state
  const [lobby, setLobby] = useState<LobbyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [simulating, setSimulating] = useState(false);

  // Lineup confirmation state (poin 3 & 4)
  const [myPlayers, setMyPlayers] = useState<SquadPlayer[]>([]);
  const [selectedFormation, setSelectedFormation] = useState("4-4-2");
  const [slotMap, setSlotMap] = useState<Map<number, string>>(new Map()); // slotIdx → playerId
  const [selectedPlayer, setSelectedPlayer] = useState<SquadPlayer | null>(
    null,
  );
  const [lineupConfirmed, setLineupConfirmed] = useState(false);
  // Track opponent confirmation status for poin 4
  const [opponentConfirmed, setOpponentConfirmed] = useState(false);
  const [opponentFormation, setOpponentFormation] = useState<string | null>(
    null,
  );

  // Match playback state
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [liveScore, setLiveScore] = useState({ home: 0, away: 0 });
  const [liveMinute, setLiveMinute] = useState(0);
  const [matchOver, setMatchOver] = useState(false);
  const [feed, setFeed] = useState<MatchEvent[]>([]);
  const [homeStartingXI, setHomeStartingXI] = useState<string[]>([]);
  const [awayStartingXI, setAwayStartingXI] = useState<string[]>([]);
  const [expPopup, setExpPopup] = useState<{
    result: "WIN" | "DRAW" | "LOSS";
    expGained: number;
  } | null>(null);

  // Refs to avoid stale closures in Pusher handlers
  const sessionRef = useRef(session);
  const lobbyRef = useRef(lobby);
  const walletRef = useRef(walletAddress);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    lobbyRef.current = lobby;
  }, [lobby]);
  useEffect(() => {
    walletRef.current = walletAddress;
  }, [walletAddress]);

  const loadLobby = useCallback(async () => {
    const res = await fetch(`/api/friendly/${code}`);
    const data = await res.json();
    if (res.ok) setLobby(data.lobby);
    else setError(data.error);
    setLoading(false);
  }, [code]);

  // Fetch own squad for lineup builder
  useEffect(() => {
    if (!walletAddress) return;
    fetch(`/api/squad?wallet=${walletAddress}`)
      .then((r) => r.json())
      .then((d) => {
        const players = d.players ?? [];
        setMyPlayers(players);
        // Pre-fill formation slots from saved squad (slotIndex from DB)
        const map = new Map<number, string>();
        players.forEach((p: SquadPlayer) => {
          if (p.slotIndex !== null && p.slotIndex !== undefined) {
            map.set(p.slotIndex, p.id);
          }
        });
        // If user has saved a formation, use it; else auto-assign top 11 by rating
        if (map.size >= 11) {
          setSlotMap(map);
        } else {
          // Auto-assign: GK first, then by position group order
          const autoMap = new Map<number, string>();
          const sorted = [...players].sort((a, b) => {
            const order: Record<string, number> = {
              GK: 0,
              DF: 1,
              MF: 2,
              FW: 3,
            };
            return (order[a.position] ?? 2) - (order[b.position] ?? 2);
          });
          sorted.slice(0, 11).forEach((p, i) => autoMap.set(i, p.id));
          setSlotMap(autoMap);
        }
      })
      .catch(() => {});
  }, [walletAddress]);

  // Pusher setup
  useEffect(() => {
    const pk = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "ap1";
    if (!pk) return;

    let pusher: any;

    import("pusher-js").then(({ default: Pusher }) => {
      pusher = new Pusher(pk, { cluster });
      const channel = pusher.subscribe(`friendly-${code}`);

      channel.bind("guest-joined", (data: any) => {
        setLobby((prev) =>
          prev ? { ...prev, guestTeam: data.guestTeam, status: "READY" } : prev,
        );
      });
      channel.bind("host-ready", () => {
        setLobby((prev) => (prev ? { ...prev, hostReady: true } : prev));
      });
      channel.bind("guest-ready", () => {
        setLobby((prev) => (prev ? { ...prev, guestReady: true } : prev));
      });

      // Poin 4 — opponent confirms lineup
      channel.bind(
        "lineup-confirmed",
        (data: { teamId: string; isHost: boolean; formation: string }) => {
          const myTeamId = sessionRef.current?.teamId;
          if (data.teamId !== myTeamId) {
            // This is the opponent's confirmation
            setOpponentConfirmed(true);
            setOpponentFormation(data.formation);
          }
        },
      );

      // both-ready replaces match-start from /ready route
      // host will call /simulate after receiving this
      channel.bind("both-ready", (data: { friendlyId: string }) => {
        const amHost =
          sessionRef.current?.teamId === lobbyRef.current?.hostTeamId;
        if (amHost && walletRef.current) {
          fetch(`/api/friendly/${code}/simulate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ solanaWallet: walletRef.current }),
          }).catch(() => {});
        }
      });

      // lineup-data: init PitchView players (sent BEFORE match-start)
      channel.bind(
        "lineup-data",
        (data: { homeStartingXI: string[]; awayStartingXI: string[] }) => {
          if (data.homeStartingXI?.length)
            setHomeStartingXI(data.homeStartingXI);
          if (data.awayStartingXI?.length)
            setAwayStartingXI(data.awayStartingXI);
        },
      );

      // match-start: show pitch UI (sent AFTER lineup-data)
      channel.bind("match-start", (_data: { friendlyId: string }) => {
        setSimulating(true);
      });

      channel.bind("match-event", (data: { events: MatchEvent[] }) => {
        setEvents((prev) => [...prev, ...data.events]);
        setFeed((prev) => [...data.events.slice().reverse(), ...prev]);
        data.events.forEach((ev) => {
          if (ev.type === "GOAL") {
            setLiveScore((s) =>
              ev.team === "HOME"
                ? { ...s, home: s.home + 1 }
                : { ...s, away: s.away + 1 },
            );
          }
          if (ev.minute) setLiveMinute(ev.minute);
        });
      });

      channel.bind("match-end", (data: any) => {
        setLiveScore({ home: data.homeScore, away: data.awayScore });
        setMatchOver(true);
        setSimulating(false);
        const myTeamId = sessionRef.current?.teamId;
        if (myTeamId) {
          const isHome = myTeamId === data.homeTeamId;
          const myScore = isHome ? data.homeScore : data.awayScore;
          const oppScore = isHome ? data.awayScore : data.homeScore;
          const result: "WIN" | "DRAW" | "LOSS" =
            myScore > oppScore ? "WIN" : myScore < oppScore ? "LOSS" : "DRAW";
          const expGained = isHome ? data.homeExpGained : data.awayExpGained;
          if (expGained != null)
            setTimeout(() => setExpPopup({ result, expGained }), 1500);
        }
      });

      channel.bind("lobby-expired", () => setError("Lobby has expired."));
      channel.bind("lobby-cancelled", () =>
        setError("Host cancelled the lobby."),
      );

      return channel;
    });

    return () => {
      pusher?.unsubscribe(`friendly-${code}`);
      pusher?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    loadLobby();
  }, [loadLobby]);

  const isHost = lobby?.hostTeamId === session?.teamId;
  const isGuest = lobby?.guestTeamId === session?.teamId;
  const isParticipant = isHost || isGuest;
  const pitchSlots = formationToSlots(selectedFormation as any, "HOME");
  const bench = myPlayers.filter((p) => !new Set(slotMap.values()).has(p.id));
  const startingXIFromSlots = Array.from(slotMap.values()).slice(0, 11);

  function assignSlot(slotIdx: number) {
    if (!selectedPlayer) return;
    const newMap = new Map(slotMap);
    for (const [si, pid] of newMap.entries()) {
      if (pid === selectedPlayer.id) newMap.delete(si);
    }
    newMap.set(slotIdx, selectedPlayer.id);
    setSlotMap(newMap);
    setSelectedPlayer(null);
  }

  async function confirmLineup() {
    setLineupConfirmed(true);
    // Notify opponent via Pusher (poin 4)
    await fetch(`/api/friendly/${code}/lineup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        solanaWallet: walletAddress,
        formation: selectedFormation,
        playerIds: startingXIFromSlots,
      }),
    });
  }

  async function markReady() {
    setIsReady(true);
    const res = await fetch(`/api/friendly/${code}/ready`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solanaWallet: walletAddress }),
    });
    const data = await res.json();
    // Host triggers simulate if they're the last to ready
    if (data.bothReady && lobby?.hostTeamId === session?.teamId) {
      setSimulating(true);
      fetch(`/api/friendly/${code}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solanaWallet: walletAddress }),
      }).catch(() => {});
    }
  }

  async function cancelLobby() {
    await fetch(`/api/friendly/${code}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solanaWallet: walletAddress }),
    });
    router.push("/friendly");
  }

  const handleMinuteChange = useCallback(
    (minute: number) => setLiveMinute(minute),
    [],
  );
  const homeSlots = formationToSlots("4-4-2", "HOME");
  const awaySlots = formationToSlots("4-4-2", "AWAY");
  const showPitch = simulating || matchOver;

  if (loading) return <Centered>Loading lobby...</Centered>;
  if (error)
    return (
      <div className="page" style={{ textAlign: "center" }}>
        <div style={{ color: "#ff5252", fontSize: 16, marginBottom: 16 }}>
          {error}
        </div>
        <button
          onClick={() => router.push("/friendly")}
          className="ws-back-button"
        >
          ← Back to Lobbies
        </button>
      </div>
    );
  if (!lobby) return <Centered>Lobby not found</Centered>;

  return (
    <div className="page">
      <button
        onClick={() => router.push("/friendly")}
        className="ws-back-button"
      >
        <span className="ws-back-icon">🏆</span>
        <span>Lobbies</span>
        <span className="ws-back-arrow">→</span>
      </button>

      {/* Scoreboard */}
      <div className="panel" style={{ padding: "16px 24px", marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
            flexWrap: "wrap",
          }}
        >
          <TeamChip team={lobby.hostTeam} ready={lobby.hostReady} />
          <div style={{ textAlign: "center" }}>
            {showPitch ? (
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "2rem",
                  fontWeight: 700,
                  letterSpacing: 4,
                }}
              >
                {liveScore.home} — {liveScore.away}
              </div>
            ) : (
              <div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "1.4rem",
                    color: "var(--ws-gold)",
                    letterSpacing: 4,
                  }}
                >
                  {code}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 4,
                  }}
                >
                  Lobby Code
                </div>
              </div>
            )}
          </div>
          <TeamChip
            team={
              lobby.guestTeam ?? {
                name: "Waiting...",
                logoSvg: null,
                jerseyColor: "#333",
              }
            }
            ready={lobby.guestReady}
            waiting={!lobby.guestTeam}
          />
        </div>
      </div>

      {/* Pre-match state */}
      {!showPitch && (
        <div className="panel" style={{ padding: 20, marginBottom: 12 }}>
          {/* Host waiting for opponent */}
          {isHost && !lobby.guestTeam && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div style={{ fontSize: 13, color: "var(--ink-dim)" }}>
                Share this code with your opponent:
              </div>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(code).catch(() => {})
                }
                title="Click to copy"
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 32,
                  color: "var(--ws-gold)",
                  letterSpacing: 8,
                  background: "rgba(255,215,0,0.08)",
                  border: "1px dashed rgba(255,215,0,0.4)",
                  borderRadius: 10,
                  padding: "12px 24px",
                  cursor: "pointer",
                }}
              >
                {code}
              </button>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ink-dim)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    animation: "ws-float 1.2s ease-in-out infinite",
                    display: "inline-block",
                  }}
                >
                  ⏳
                </span>
                Waiting for opponent to join...
              </div>
              <button
                onClick={cancelLobby}
                style={{
                  padding: "8px 20px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: "transparent",
                  border: "1px solid rgba(255,82,82,0.4)",
                  color: "#ff5252",
                  fontSize: 12,
                  fontFamily: "var(--display)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                ✕ Cancel Lobby
              </button>
            </div>
          )}

          {/* Both in lobby — show lineup builder (poin 3) */}
          {isParticipant && lobby.guestTeam && !isReady && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 280px",
                gap: 14,
              }}
            >
              {/* Left: pitch formation */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <select
                    value={selectedFormation}
                    onChange={(e) => {
                      setSelectedFormation(e.target.value);
                      setSlotMap(new Map());
                    }}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 6,
                      background: "var(--panel-bg)",
                      border: "1px solid var(--border)",
                      color: "var(--ink)",
                      fontSize: 13,
                      fontFamily: "var(--mono)",
                    }}
                  >
                    {FORMATIONS.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>

                  {/* Poin 4: opponent status */}
                  <div
                    style={{
                      fontSize: 11,
                      color: opponentConfirmed
                        ? "var(--ws-green-bright)"
                        : "var(--ink-dim)",
                      padding: "4px 10px",
                      borderRadius: 10,
                      border: `1px solid ${opponentConfirmed ? "rgba(46,204,113,0.3)" : "var(--border)"}`,
                      background: opponentConfirmed
                        ? "rgba(46,204,113,0.08)"
                        : "transparent",
                    }}
                  >
                    {opponentConfirmed
                      ? `✓ Opponent confirmed (${opponentFormation})`
                      : "⏳ Opponent setting lineup..."}
                  </div>

                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    {!lineupConfirmed ? (
                      <button
                        onClick={confirmLineup}
                        disabled={slotMap.size < 11 || myPlayers.length < 12}
                        style={{
                          padding: "7px 16px",
                          borderRadius: 6,
                          border: "none",
                          background:
                            slotMap.size >= 11 && myPlayers.length >= 12
                              ? "rgba(255,215,0,0.15)"
                              : "var(--border)",
                          color:
                            slotMap.size >= 11 && myPlayers.length >= 12
                              ? "var(--ws-gold)"
                              : "var(--ink-dim)",
                          fontSize: 12,
                          fontFamily: "var(--display)",
                          textTransform: "uppercase",
                          cursor:
                            slotMap.size >= 11 && myPlayers.length >= 12
                              ? "pointer"
                              : "not-allowed",
                          outline: `1px solid ${slotMap.size >= 11 && myPlayers.length >= 12 ? "rgba(255,215,0,0.3)" : "transparent"}`,
                        }}
                      >
                        ✓ Confirm Lineup ({slotMap.size}/11)
                      </button>
                    ) : (
                      <button
                        onClick={markReady}
                        style={{
                          padding: "7px 20px",
                          borderRadius: 6,
                          border: "none",
                          background: "var(--ws-gold)",
                          color: "#0a0d12",
                          fontSize: 12,
                          fontFamily: "var(--display)",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          cursor: "pointer",
                        }}
                      >
                        🚀 Ready!
                      </button>
                    )}
                  </div>
                </div>

                {lineupConfirmed && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--ws-green-bright)",
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    ✓ Lineup confirmed ({selectedFormation}) — waiting for
                    opponent...
                    <button
                      onClick={() => setLineupConfirmed(false)}
                      style={{
                        fontSize: 10,
                        color: "var(--ink-dim)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Edit
                    </button>
                  </div>
                )}

                {myPlayers.length < 12 && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#ff9800",
                      marginBottom: 8,
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: "rgba(255,152,0,0.08)",
                      border: "1px solid rgba(255,152,0,0.3)",
                    }}
                  >
                    ⚠ Need at least 12 players in squad ({myPlayers.length}{" "}
                    current)
                  </div>
                )}

                {/* Mini pitch */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "105/68",
                    background: "linear-gradient(160deg, #1a5c2e, #14452299)",
                    borderRadius: 6,
                    overflow: "hidden",
                  }}
                >
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
                      x="85.5"
                      y="15"
                      width="16.5"
                      height="38"
                      fill="none"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="0.6"
                    />
                  </svg>

                  {pitchSlots.map((slot, slotIdx) => {
                    const occupantId = slotMap.get(slotIdx);
                    const occupant = myPlayers.find((p) => p.id === occupantId);
                    const isSelected =
                      !!selectedPlayer && occupant?.id === selectedPlayer.id;

                    return (
                      <div
                        key={slotIdx}
                        onClick={() => {
                          if (selectedPlayer) {
                            if (occupant?.id === selectedPlayer.id)
                              setSelectedPlayer(null);
                            else assignSlot(slotIdx);
                          } else if (occupant) {
                            setSelectedPlayer(occupant);
                          }
                        }}
                        style={{
                          position: "absolute",
                          left: `${slot.x}%`,
                          top: `${slot.y}%`,
                          transform: "translate(-50%,-50%)",
                          width: 44,
                          height: 52,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 1,
                          zIndex: isSelected ? 2 : 1,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 8,
                            fontWeight: 700,
                            color: POS_COLOR[slot.posGroup] || "#fff",
                            background: "rgba(0,0,0,0.7)",
                            padding: "1px 4px",
                            borderRadius: 3,
                          }}
                        >
                          {(slot as FormationSlot).label ?? slot.posGroup}
                        </div>
                        {occupant ? (
                          <>
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: "50%",
                                background: lobby.hostTeam.jerseyColor,
                                border: isSelected
                                  ? "2.5px solid var(--ws-gold)"
                                  : "2px solid rgba(255,255,255,0.85)",
                                overflow: "hidden",
                                boxShadow: isSelected
                                  ? "0 0 10px rgba(255,215,0,0.5)"
                                  : "0 2px 6px rgba(0,0,0,0.5)",
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
                                padding: "1px 3px",
                                borderRadius: 2,
                                maxWidth: 40,
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
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              background: selectedPlayer
                                ? "rgba(255,215,0,0.15)"
                                : "rgba(255,255,255,0.06)",
                              border: selectedPlayer
                                ? "2px dashed rgba(255,215,0,0.6)"
                                : "2px dashed rgba(255,255,255,0.2)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {selectedPlayer && (
                              <span
                                style={{
                                  color: "rgba(255,215,0,0.8)",
                                  fontSize: 12,
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

              {/* Right: bench/player list */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 6,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Bench ({bench.length})</span>
                  <span
                    style={{
                      color:
                        slotMap.size === 11
                          ? "var(--ws-green-bright)"
                          : "var(--ws-gold)",
                    }}
                  >
                    {slotMap.size}/11
                  </span>
                </div>
                <div
                  className="scroll-thin"
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    maxHeight: 380,
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  {bench.map((p) => (
                    <div
                      key={p.id}
                      onClick={() =>
                        setSelectedPlayer(
                          selectedPlayer?.id === p.id ? null : p,
                        )
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 8px",
                        borderRadius: 6,
                        cursor: "pointer",
                        background:
                          selectedPlayer?.id === p.id
                            ? "rgba(255,215,0,0.1)"
                            : "transparent",
                        border:
                          selectedPlayer?.id === p.id
                            ? "1px solid rgba(255,215,0,0.4)"
                            : "1px solid transparent",
                        transition: "all 0.12s",
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          flexShrink: 0,
                          borderRadius: "50%",
                          overflow: "hidden",
                          border: "1px solid var(--border)",
                        }}
                        dangerouslySetInnerHTML={{ __html: p.avatarSvg ?? "" }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.name}
                        </div>
                        <div style={{ fontSize: 9, color: "var(--ink-dim)" }}>
                          <span
                            style={{
                              padding: "1px 4px",
                              borderRadius: 2,
                              background: `${POS_COLOR[p.position] || "#888"}22`,
                              color: POS_COLOR[p.position] || "#888",
                              fontWeight: 700,
                              marginRight: 4,
                            }}
                          >
                            {p.position}
                          </span>
                          {"★".repeat(p.starRating)}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          fontFamily: "var(--mono)",
                          color: "var(--ws-gold)",
                        }}
                      >
                        {p.pace}/{p.shooting}/{p.passing}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isReady && !matchOver && (
            <p style={{ color: "var(--ws-green-bright)", textAlign: "center" }}>
              ✓ You&apos;re ready — waiting for {isHost ? "opponent" : "host"}
              ...
            </p>
          )}

          {lobby.hostReady && lobby.guestReady && !simulating && (
            <div
              style={{
                textAlign: "center",
                marginTop: 8,
                fontSize: 13,
                color: "var(--ws-green-bright)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  animation: "ws-float 0.8s ease-in-out infinite",
                  display: "inline-block",
                }}
              >
                ⚽
              </span>
              Both ready — match starting...
            </div>
          )}
        </div>
      )}

      {/* Live pitch */}
      {showPitch && (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 12 }}
        >
          <div className="panel" style={{ padding: 12 }}>
            <PitchView
              events={events}
              homeStartingXI={homeStartingXI}
              awayStartingXI={awayStartingXI}
              homeFormationSlots={homeSlots}
              awayFormationSlots={awaySlots}
              speed={1}
              onMinuteChange={handleMinuteChange}
              paused={matchOver}
            />
          </div>
          <div
            className="panel scroll-thin"
            style={{ overflowY: "auto", maxHeight: 420 }}
          >
            <div
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid var(--border)",
                fontSize: 11,
                fontFamily: "var(--display)",
                textTransform: "uppercase",
                letterSpacing: 1,
                color: "var(--ink-dim)",
              }}
            >
              Commentary
            </div>
            <div
              style={{
                padding: 8,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {feed.length === 0 && (
                <p
                  style={{ color: "var(--ink-dim)", fontSize: 12, padding: 8 }}
                >
                  Match starting...
                </p>
              )}
              {feed.map((ev, i) => (
                <div
                  key={i}
                  style={{
                    padding: "6px 8px",
                    fontSize: 12,
                    display: "flex",
                    gap: 8,
                    borderLeft:
                      ev.type === "GOAL"
                        ? "2px solid var(--ws-gold)"
                        : "2px solid transparent",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      color: "var(--ink-dim)",
                      minWidth: 28,
                    }}
                  >
                    {ev.minute}&apos;
                  </span>
                  <span>
                    {ev.type === "GOAL"
                      ? "⚽ GOAL!"
                      : ev.type === "SAVE"
                        ? "🧤 Save"
                        : ev.type === "YELLOW_CARD"
                          ? "🟨 Yellow"
                          : ev.type === "SHOT"
                            ? "🎯 Shot"
                            : ev.type === "HALF_TIME"
                              ? "🔔 Half time"
                              : ev.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {matchOver && (
        <div
          className="panel"
          style={{ padding: 20, textAlign: "center", marginTop: 12 }}
        >
          <div
            style={{
              fontFamily: "var(--display)",
              fontSize: "1.4rem",
              marginBottom: 8,
            }}
          >
            Full Time — {liveScore.home} : {liveScore.away}
          </div>
          <button
            onClick={() => router.push("/friendly")}
            style={{
              padding: "10px 24px",
              borderRadius: 6,
              border: "none",
              background: "var(--ws-gold)",
              color: "#0a0d12",
              fontFamily: "var(--display)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Back to Lobbies
          </button>
        </div>
      )}

      {expPopup && (
        <FriendlyExpPopup
          result={expPopup.result}
          expGained={expPopup.expGained}
          onClose={() => {
            setExpPopup(null);
            router.push("/friendly");
          }}
        />
      )}
    </div>
  );
}

const RESULT_CFG = {
  WIN: {
    emoji: "🏆",
    label: "Victory!",
    color: "#ffd700",
    glow: "rgba(255,215,0,0.4)",
  },
  DRAW: {
    emoji: "🤝",
    label: "Draw",
    color: "#4fc3f7",
    glow: "rgba(79,195,247,0.3)",
  },
  LOSS: {
    emoji: "💔",
    label: "Defeat",
    color: "#ff5252",
    glow: "rgba(255,82,82,0.3)",
  },
};

function FriendlyExpPopup({
  result,
  expGained,
  onClose,
}: {
  result: "WIN" | "DRAW" | "LOSS";
  expGained: number;
  onClose: () => void;
}) {
  const cfg = RESULT_CFG[result];
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);
  function close() {
    setVisible(false);
    setTimeout(onClose, 250);
  }
  return (
    <>
      <div
        onClick={close}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 300,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(4px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.25s",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: visible
            ? "translate(-50%,-50%) scale(1)"
            : "translate(-50%,-50%) scale(0.88)",
          zIndex: 301,
          width: "min(360px, 90vw)",
          background: "linear-gradient(160deg, #0d1117, #0a0d12)",
          border: `1px solid ${cfg.color}44`,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: `0 0 40px ${cfg.glow}`,
          opacity: visible ? 1 : 0,
          transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div
          style={{
            height: 3,
            background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`,
          }}
        />
        <div style={{ padding: "24px 22px", textAlign: "center" }}>
          <div
            style={{
              fontSize: 52,
              marginBottom: 8,
              filter: `drop-shadow(0 0 16px ${cfg.glow})`,
              animation:
                "exp-bounce 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both",
            }}
          >
            {cfg.emoji}
          </div>
          <div
            style={{
              fontFamily: "var(--display)",
              fontSize: "1.7rem",
              textTransform: "uppercase",
              letterSpacing: 2,
              color: cfg.color,
              marginBottom: 4,
            }}
          >
            {cfg.label}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--ink-dim)",
              marginBottom: 18,
              letterSpacing: 1,
            }}
          >
            FRIENDLY MATCH
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: "14px 18px",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "var(--ink-dim)",
                textTransform: "uppercase",
                letterSpacing: 2,
                marginBottom: 8,
              }}
            >
              Manager EXP Earned
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "2rem",
                fontWeight: 700,
                color: cfg.color,
              }}
            >
              +{expGained}{" "}
              <span style={{ fontSize: "0.8rem", color: "var(--ink-dim)" }}>
                EXP
              </span>
            </div>
            <div
              style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 4 }}
            >
              Friendly awards reduced EXP
            </div>
          </div>
          <button
            onClick={close}
            style={{
              width: "100%",
              padding: "11px",
              borderRadius: 8,
              border: "none",
              background: `linear-gradient(135deg, ${cfg.color}bb, ${cfg.color})`,
              color: "#0a0d12",
              fontFamily: "var(--display)",
              fontWeight: 700,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 2,
              cursor: "pointer",
            }}
          >
            Back to Lobbies
          </button>
        </div>
        <style>{`@keyframes exp-bounce { from { transform: scale(0.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
      </div>
    </>
  );
}

function TeamChip({
  team,
  ready,
  waiting,
}: {
  team: { name: string; logoSvg: string | null; jerseyColor: string };
  ready?: boolean;
  waiting?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {team.logoSvg ? (
        <div
          style={{ width: 40 }}
          dangerouslySetInnerHTML={{ __html: team.logoSvg }}
        />
      ) : (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: team.jerseyColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
          }}
        >
          ⚽
        </div>
      )}
      <div>
        <div
          style={{
            fontFamily: "var(--display)",
            fontSize: "0.9rem",
            textTransform: "uppercase",
            color: waiting ? "var(--ink-dim)" : "var(--ink)",
          }}
        >
          {team.name}
        </div>
        {ready !== undefined && (
          <div
            style={{
              fontSize: 10,
              color: ready ? "var(--ws-green-bright)" : "var(--ink-dim)",
            }}
          >
            {ready ? "✓ Ready" : "Not ready"}
          </div>
        )}
      </div>
    </div>
  );
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
