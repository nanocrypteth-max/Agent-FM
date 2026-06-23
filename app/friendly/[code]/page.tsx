"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import AuthWall from "@/components/auth/AuthWall";
import PitchView from "@/components/pitch/PitchView";
import { formationToSlots } from "@/lib/match-engine/formations";
import type { MatchEvent } from "@/lib/match-engine/types";

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

const FORMATIONS = [
  "4-4-2",
  "4-3-3",
  "4-2-3-1",
  "3-5-2",
  "5-3-2",
  "4-5-1",
  "4-4-1-1",
  "4-3-1-2",
] as const;

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

  const [lobby, setLobby] = useState<LobbyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [selectedFormation, setSelectedFormation] = useState("4-4-2");

  // PitchView player tracking
  const [homeStartingXI, setHomeStartingXI] = useState<string[]>([]);
  const [awayStartingXI, setAwayStartingXI] = useState<string[]>([]);

  // EXP popup after match ends
  const [expPopup, setExpPopup] = useState<{
    result: "WIN" | "DRAW" | "LOSS";
    expGained: number;
  } | null>(null);

  // Match playback state
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [liveScore, setLiveScore] = useState({ home: 0, away: 0 });
  const [liveMinute, setLiveMinute] = useState(0);
  const [matchOver, setMatchOver] = useState(false);
  const [feed, setFeed] = useState<MatchEvent[]>([]);
  const [pusherInstance, setPusherInstance] = useState<any>(null);

  // Refs to avoid stale closures in Pusher event handlers
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

  // Initialize Pusher and bind events
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

      channel.bind(
        "match-start",
        (data: {
          friendlyId: string;
          homeStartingXI?: string[];
          awayStartingXI?: string[];
        }) => {
          setSimulating(true);
          if (data.homeStartingXI?.length)
            setHomeStartingXI(data.homeStartingXI);
          if (data.awayStartingXI?.length)
            setAwayStartingXI(data.awayStartingXI);
          // Host triggers simulate — Redis nx lock prevents double-simulate
          const amHost =
            sessionRef.current?.teamId === lobbyRef.current?.hostTeamId;
          if (amHost && walletRef.current) {
            fetch(`/api/friendly/${code}/simulate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ solanaWallet: walletRef.current }),
            }).catch(() => {});
          }
        },
      );

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

        // Show EXP popup — determine if this client is home or away
        const myTeamId = sessionRef.current?.teamId;
        if (myTeamId && (data.homeTeamId || data.awayTeamId)) {
          const isHome = myTeamId === data.homeTeamId;
          const myScore = isHome ? data.homeScore : data.awayScore;
          const oppScore = isHome ? data.awayScore : data.homeScore;
          const result: "WIN" | "DRAW" | "LOSS" =
            myScore > oppScore ? "WIN" : myScore < oppScore ? "LOSS" : "DRAW";
          const expGained = isHome ? data.homeExpGained : data.awayExpGained;
          if (expGained != null) {
            setTimeout(() => setExpPopup({ result, expGained }), 1500);
          }
        }
      });

      channel.bind("lobby-expired", () => setError("Lobby has expired."));
      channel.bind("lobby-cancelled", () =>
        setError("Host cancelled the lobby."),
      );

      setPusherInstance(pusher);
    });

    return () => {
      pusher?.unsubscribe(`friendly-${code}`);
      pusher?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]); // intentionally omit pusherInstance — would cause re-subscribe loop

  useEffect(() => {
    loadLobby();
  }, [loadLobby]);

  const isHost = lobby?.hostTeamId === session?.teamId;
  const isGuest = lobby?.guestTeamId === session?.teamId;
  const isParticipant = isHost || isGuest;

  async function markReady() {
    setIsReady(true);
    const res = await fetch(`/api/friendly/${code}/ready`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solanaWallet: walletAddress }),
    });
    const data = await res.json();

    // Host also triggers simulate here — covers case where guest was already ready
    // and host just became last to ready. Pusher match-start covers the reverse.
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

  const handleMinuteChange = useCallback((minute: number) => {
    setLiveMinute(minute);
  }, []);

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

  const showPitch = simulating || matchOver;
  const homeSlots = formationToSlots("4-4-2", "HOME");
  const awaySlots = formationToSlots("4-4-2", "AWAY");

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

      {/* Scoreboard header */}
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

      {/* Lobby state panel */}
      {!showPitch && (
        <div
          className="panel"
          style={{ padding: 20, marginBottom: 12, textAlign: "center" }}
        >
          {/* Spectator */}
          {!isParticipant && (
            <p style={{ color: "var(--ink-dim)", fontSize: 13 }}>
              Spectating — waiting for players
            </p>
          )}

          {/* Host waiting for guest */}
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

          {/* Formation picker + ready button */}
          {isParticipant && lobby.guestTeam && !isReady && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
              }}
            >
              <p style={{ color: "var(--ink-dim)", fontSize: 13 }}>
                Both managers present — choose your formation and mark ready!
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--ink-dim)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Formation:
                </label>
                <select
                  value={selectedFormation}
                  onChange={(e) => setSelectedFormation(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: "var(--panel-bg)",
                    border: "1px solid var(--border)",
                    color: "var(--ink)",
                    fontSize: 14,
                    fontFamily: "var(--mono)",
                  }}
                >
                  {FORMATIONS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={markReady}
                style={{
                  padding: "12px 32px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--ws-gold)",
                  color: "#0a0d12",
                  fontFamily: "var(--display)",
                  fontWeight: 700,
                  fontSize: 14,
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                ✓ Ready ({selectedFormation})
              </button>
            </div>
          )}

          {/* Waiting for other player after marking ready */}
          {(isReady && !lobby.hostReady) || (isReady && !lobby.guestReady) ? (
            <p style={{ color: "var(--ws-green-bright)", marginTop: 8 }}>
              ✓ You&apos;re ready — waiting for {isHost ? "opponent" : "host"}
              ...
            </p>
          ) : null}

          {/* Both ready — about to start */}
          {lobby.hostReady && lobby.guestReady && !simulating && (
            <div
              style={{
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

      {/* Live pitch + commentary */}
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
                          ? "🟨 Yellow card"
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

      {/* Full time result */}
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
          width: "min(380px, 90vw)",
          background: "linear-gradient(160deg, #0d1117, #0a0d12)",
          border: `1px solid ${cfg.color}44`,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: `0 0 40px ${cfg.glow}, 0 20px 50px rgba(0,0,0,0.6)`,
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
        <div style={{ padding: "28px 24px", textAlign: "center" }}>
          <div
            style={{
              fontSize: 56,
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
              fontSize: "1.8rem",
              textTransform: "uppercase",
              letterSpacing: 2,
              color: cfg.color,
              marginBottom: 6,
            }}
          >
            {cfg.label}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--ink-dim)",
              marginBottom: 20,
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
              marginBottom: 16,
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
              <span
                style={{
                  fontSize: "0.9rem",
                  color: "var(--ink-dim)",
                  fontFamily: "var(--display)",
                }}
              >
                EXP
              </span>
            </div>
            <div
              style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 6 }}
            >
              Friendly matches award reduced EXP
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
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: 2,
              cursor: "pointer",
            }}
          >
            Back to Lobbies
          </button>
        </div>
        <style>{`
          @keyframes exp-bounce {
            from { transform: scale(0.3); opacity: 0; }
            to   { transform: scale(1);   opacity: 1; }
          }
        `}</style>
      </div>
    </>
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
