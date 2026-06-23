"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import AuthWall from "@/components/auth/AuthWall";
import PitchView from "@/components/pitch/PitchView";
import { formationToSlots } from "@/lib/match-engine/formations";
import type { MatchEvent } from "@/lib/match-engine/types";

// Pusher client — lazy loaded to avoid SSR issues
let PusherClient: any = null;

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

  // Match state
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [liveScore, setLiveScore] = useState({ home: 0, away: 0 });
  const [liveMinute, setLiveMinute] = useState(0);
  const [matchOver, setMatchOver] = useState(false);
  const [feed, setFeed] = useState<MatchEvent[]>([]);
  const [pusherInstance, setPusherInstance] = useState<any>(null);

  const loadLobby = useCallback(async () => {
    const res = await fetch(`/api/friendly/${code}`);
    const data = await res.json();
    if (res.ok) setLobby(data.lobby);
    else setError(data.error);
    setLoading(false);
  }, [code]);

  // Initialize Pusher
  useEffect(() => {
    const pk = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "ap1";
    if (!pk) return;

    import("pusher-js").then(({ default: Pusher }) => {
      const p = new Pusher(pk, { cluster });
      const channel = p.subscribe(`friendly-${code}`);

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
      channel.bind("match-start", () => {
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
      });
      channel.bind("lobby-expired", () => setError("Lobby has expired."));
      channel.bind("lobby-cancelled", () =>
        setError("Host cancelled the lobby."),
      );

      setPusherInstance(p);
    });

    return () => {
      pusherInstance?.unsubscribe(`friendly-${code}`);
      pusherInstance?.disconnect();
    };
  }, [code]);

  useEffect(() => {
    loadLobby();
  }, [loadLobby]);

  const isHost = lobby?.hostTeamId === session?.teamId;
  const isGuest = lobby?.guestTeamId === session?.teamId;
  const isParticipant = isHost || isGuest;
  const [selectedFormation, setSelectedFormation] = useState("4-4-2");

  async function markReady() {
    setIsReady(true);
    await fetch(`/api/friendly/${code}/ready`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solanaWallet: walletAddress }),
    });
  }

  async function startMatch() {
    setSimulating(true);
    await fetch(`/api/friendly/${code}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solanaWallet: walletAddress }),
    });
  }

  const handleMinuteChange = useCallback(
    (minute: number, eventsThisMinute: MatchEvent[]) => {
      setLiveMinute(minute);
    },
    [],
  );

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
  const defaultSlots = formationToSlots("4-4-2", "HOME");
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

      {/* Lobby header */}
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

      {!showPitch && (
        <div
          className="panel"
          style={{ padding: 20, marginBottom: 12, textAlign: "center" }}
        >
          {lobby.status === "WAITING" && !isParticipant && (
            <p style={{ color: "var(--ink-dim)", fontSize: 13 }}>
              Spectating — waiting for players
            </p>
          )}

          {lobby.status === "WAITING" && isHost && !lobby.guestTeam && (
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
              {/* Copy code button */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(code).catch(() => {});
                }}
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
                title="Click to copy"
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
              {/* Cancel lobby */}
              <button
                onClick={async () => {
                  await fetch(`/api/friendly/${code}`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ solanaWallet: walletAddress }),
                  });
                  router.push("/friendly");
                }}
                style={{
                  marginTop: 4,
                  padding: "8px 20px",
                  borderRadius: 6,
                  background: "transparent",
                  border: "1px solid rgba(255,82,82,0.4)",
                  color: "#ff5252",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "var(--display)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                ✕ Cancel Lobby
              </button>
            </div>
          )}

          {(lobby.status === "READY" || lobby.guestTeam) &&
            isParticipant &&
            !isReady && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <p style={{ color: "var(--ink-dim)", fontSize: 13 }}>
                  Both managers present — choose your formation then mark ready!
                </p>
                {/* Formation picker — poin 10 */}
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
                    {[
                      "4-4-2",
                      "4-3-3",
                      "4-2-3-1",
                      "3-5-2",
                      "5-3-2",
                      "4-5-1",
                      "4-4-1-1",
                      "4-3-1-2",
                    ].map((f) => (
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

          {isReady && !matchOver && (
            <p style={{ color: "var(--ws-green-bright)" }}>
              ✓ You're ready — waiting for {isHost ? "opponent" : "host"}...
            </p>
          )}

          {lobby.hostReady && lobby.guestReady && isHost && !simulating && (
            <button
              onClick={startMatch}
              style={{
                padding: "14px 40px",
                borderRadius: 8,
                border: "none",
                background: "var(--ws-gold)",
                color: "#0a0d12",
                fontFamily: "var(--display)",
                fontWeight: 700,
                fontSize: 16,
                textTransform: "uppercase",
                cursor: "pointer",
                marginTop: 12,
              }}
            >
              ⚽ Kick Off!
            </button>
          )}
        </div>
      )}

      {showPitch && (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}
        >
          <div className="panel" style={{ padding: 12 }}>
            <PitchView
              events={events}
              homeStartingXI={[]}
              awayStartingXI={[]}
              homeFormationSlots={defaultSlots}
              awayFormationSlots={awaySlots}
              speed={1}
              onMinuteChange={handleMinuteChange}
              paused={matchOver}
            />
          </div>
          <div
            className="panel scroll-thin"
            style={{ overflowY: "auto", maxHeight: 400 }}
          >
            <div
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid var(--border)",
                fontSize: 12,
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
                      minWidth: 24,
                    }}
                  >
                    {ev.minute}'
                  </span>
                  <span>
                    {ev.type === "GOAL"
                      ? "⚽ GOAL!"
                      : ev.type === "SAVE"
                        ? "🧤 Save"
                        : ev.type === "YELLOW_CARD"
                          ? "🟨 Yellow"
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
              fontSize: "1.3rem",
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
            fontSize: "0.95rem",
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
