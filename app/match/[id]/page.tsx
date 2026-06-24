"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import PitchView from "@/components/pitch/PitchView";
import TacticsForm from "@/components/tactics/TacticsForm";
import { formationToSlots } from "@/lib/match-engine/formations";
import type { MatchEvent, Formation } from "@/lib/match-engine/types";
import { useMatchSounds, eventToSound } from "@/lib/sound/useMatchSounds";
import AuthWall from "@/components/auth/AuthWall";
import { useAuth } from "@/lib/auth/useAuth";

interface TeamInfo {
  id: string;
  name: string;
  isUserControlled: boolean;
}

interface TacticsResult {
  formation: Formation;
  mentality: string;
  startingXI: string[];
  instructions: { pressing: string; tempo: string; width: string };
  reasoning: string;
}

interface FixtureData {
  fixtureId: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  simulated: boolean;
  homeScore?: number;
  awayScore?: number;
  homeTactics?: TacticsResult;
  awayTactics?: TacticsResult;
  events?: MatchEvent[];
}

const EVENT_ICONS: Record<string, string> = {
  KICK_OFF: "🟢",
  GOAL: "⚽",
  SHOT: "🎯",
  SAVE: "🧤",
  FOUL: "⚠️",
  YELLOW_CARD: "🟨",
  RED_CARD: "🟥",
  CORNER: "↪",
  OFFSIDE: "🚩",
  SUBSTITUTION: "🔄",
  HALF_TIME: "⏱",
  FULL_TIME: "🏁",
};

const EVENT_LABELS: Record<string, string> = {
  KICK_OFF: "Kick-off!",
  GOAL: "GOAL!",
  SHOT: "Shot attempt",
  SAVE: "Great save!",
  FOUL: "Foul committed",
  YELLOW_CARD: "Yellow card",
  RED_CARD: "Red card",
  CORNER: "Corner kick",
  OFFSIDE: "Offside",
  SUBSTITUTION: "Substitution",
  HALF_TIME: "Half-time",
  FULL_TIME: "Full-time",
};

export default function MatchPage() {
  return (
    <AuthWall>
      <MatchContent />
    </AuthWall>
  );
}

function MatchContent() {
  const params = useParams();
  const router = useRouter();
  const fixtureId = params.id as string;
  const { walletAddress } = useAuth();

  // Expose wallet to window so the FULL_TIME handler can access it
  useEffect(() => {
    if (walletAddress) (window as any).__agentfm_wallet = walletAddress;
  }, [walletAddress]);

  const [data, setData] = useState<FixtureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [squad, setSquad] = useState<any[] | null>(null);
  const [tacticsSubmitted, setTacticsSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState<"commentary" | "ai">("commentary");
  const [liveMinute, setLiveMinute] = useState(0);
  const [liveScore, setLiveScore] = useState({ home: 0, away: 0 });
  const [feed, setFeed] = useState<MatchEvent[]>([]);
  const [matchOver, setMatchOver] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [goalFlash, setGoalFlash] = useState(0);
  const [showHalfTimeModal, setShowHalfTimeModal] = useState(false);
  const [halfTimeFormation, setHalfTimeFormation] = useState<string>("4-4-2");
  const isUserInMatchRef = useRef(false);
  const [expPopup, setExpPopup] = useState<{
    result: "WIN" | "DRAW" | "LOSS";
    expGained: number;
    newExp: number;
    newLevel: number;
    leveledUp: boolean;
    mvpName: string | null;
  } | null>(null);
  const { play, muted, toggleMute, startAmbience, stopAmbience } =
    useMatchSounds();

  // Stop crowd ambience when navigating away from this page
  useEffect(() => {
    return () => stopAmbience();
  }, [stopAmbience]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fixtures/${fixtureId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load fixture");
      setData(json);

      // For already-simulated matches: pre-populate state so PitchView
      // plays through once and stops (paused=matchOver prevents infinite replay).
      if (json.simulated && json.events?.length > 0) {
        setLiveScore({ home: json.homeScore ?? 0, away: json.awayScore ?? 0 });
        setFeed([...json.events].reverse());
        // matchOver starts false so PitchView can animate through events once
        // It will be set true when FULL_TIME event is processed
      }

      if (!json.simulated) {
        const userTeam = json.homeTeam.isUserControlled
          ? json.homeTeam
          : json.awayTeam.isUserControlled
            ? json.awayTeam
            : null;
        if (userTeam) {
          const squadRes = await fetch(`/api/teams/${userTeam.id}/squad`);
          const squadJson = await squadRes.json();
          setSquad(squadJson.players);

          // Check if tactics already submitted for this fixture
          const tacticsRes = await fetch(`/api/fixtures/${fixtureId}/tactics`);
          if (tacticsRes.ok) {
            setTacticsSubmitted(true);
          } else {
            // AUTO-CONFIRM: Try to build tactics from saved squad formation
            const squadData = await fetch("/api/squad");
            if (squadData.ok) {
              const { players, team } = await squadData.json();
              // Players with a slotIndex set = starting XI
              const startingXI = players
                .filter(
                  (p: any) => p.slotIndex !== null && p.slotIndex !== undefined,
                )
                .sort((a: any, b: any) => a.slotIndex - b.slotIndex)
                .map((p: any) => p.id);

              if (startingXI.length === 11) {
                // Auto-submit tactics from squad formation
                const autoSubmit = await fetch(
                  `/api/fixtures/${fixtureId}/tactics`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      formation: team.formation ?? "4-4-2",
                      mentality: "BALANCED",
                      startingXI,
                      instructions: {
                        pressing: "MEDIUM",
                        tempo: "NORMAL",
                        width: "NORMAL",
                      },
                    }),
                  },
                );
                setTacticsSubmitted(autoSubmit.ok);
                if (autoSubmit.ok) {
                  setError(null); // clear any prior error
                }
              }
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [fixtureId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSimulate() {
    setSimulating(true);
    setError(null);
    try {
      const res = await fetch(`/api/fixtures/${fixtureId}/simulate`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Simulation failed");
      await load();
      setLiveMinute(0);
      setLiveScore({ home: 0, away: 0 });
      setFeed([]);
      setMatchOver(false);
      startAmbience(); // begin stadium crowd background loop
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSimulating(false);
    }
  }

  const handleMinuteChange = useCallback(
    (minute: number, events: MatchEvent[]) => {
      setLiveMinute(minute);
      setFeed((prev) => [...events.slice().reverse(), ...prev]);

      for (const ev of events) {
        if (ev.type === "GOAL") {
          setLiveScore((s) =>
            ev.team === "HOME"
              ? { ...s, home: s.home + 1 }
              : { ...s, away: s.away + 1 },
          );
          setGoalFlash((k) => k + 1);
        }

        if (ev.type === "FULL_TIME") {
          setMatchOver(true);
          stopAmbience();
          // Fetch updated session for EXP popup after a short delay
          setTimeout(async () => {
            try {
              const sessionRes = await fetch(`/api/fixtures/${fixtureId}`);
              const sessionData = await sessionRes.json();
              if (!sessionRes.ok) return;

              const homeScore = sessionData.homeScore ?? 0;
              const awayScore = sessionData.awayScore ?? 0;
              const isHome = sessionData.homeTeam?.isUserControlled;
              const isAway = sessionData.awayTeam?.isUserControlled;
              if (!isHome && !isAway) return;

              const userScore = isHome ? homeScore : awayScore;
              const oppScore = isHome ? awayScore : homeScore;
              const result: "WIN" | "DRAW" | "LOSS" =
                userScore > oppScore
                  ? "WIN"
                  : userScore === oppScore
                    ? "DRAW"
                    : "LOSS";

              const walletRes = await fetch(
                "/api/auth?" +
                  new URLSearchParams({
                    wallet: (window as any).__agentfm_wallet ?? "",
                  }),
              );
              if (walletRes.ok) {
                const walletData = await walletRes.json();
                const s = walletData.session;
                if (s) {
                  const expGained =
                    result === "WIN"
                      ? 50 + s.managerLevel * 10
                      : result === "DRAW"
                        ? 20
                        : 10;

                  const mvpEvent = sessionData.matchResult?.events
                    ?.filter((e: any) => e.playerId)
                    ?.reduce((best: any, e: any) => {
                      const pts =
                        e.type === "GOAL"
                          ? 3
                          : e.type === "SAVE"
                            ? 2
                            : e.type === "SHOT"
                              ? 1
                              : 0;
                      return pts > (best?.pts ?? 0) ? { ...e, pts } : best;
                    }, null);

                  setExpPopup({
                    result,
                    expGained,
                    newExp: s.managerExp,
                    newLevel: s.managerLevel,
                    leveledUp: false,
                    mvpName: mvpEvent?.playerName ?? null,
                  });
                }
              }
            } catch {}
          }, 1800);
        }

        // Half-time modal — separate from FULL_TIME block to avoid type narrowing error
        if (ev.type === "HALF_TIME" && isUserInMatchRef.current) {
          setShowHalfTimeModal(true);
        }

        const soundKey = eventToSound(ev.type);
        if (soundKey) play(soundKey);
      }
    },
    [play],
  );

  if (loading) return <Centered>Loading...</Centered>;
  if (error) return <Centered>Error: {error}</Centered>;
  if (!data) return <Centered>Not found</Centered>;

  const userTeam = data.homeTeam.isUserControlled
    ? data.homeTeam
    : data.awayTeam.isUserControlled
      ? data.awayTeam
      : null;
  // Keep ref updated so the event handler can check without stale closure
  isUserInMatchRef.current = !!userTeam;

  // ---- PRE-MATCH ----
  if (!data.simulated) {
    return (
      <div className="page" style={{ maxWidth: 900 }}>
        <BackLink router={router} />
        <header style={{ marginBottom: 20 }}>
          <div className="eyebrow">Pre-Match · Matchday Setup</div>
          <h1 style={{ fontSize: "1.9rem", textTransform: "uppercase" }}>
            {data.homeTeam.name}
            <span style={{ color: "var(--ink-dim)", margin: "0 10px" }}>
              vs
            </span>
            {data.awayTeam.name}
          </h1>
        </header>

        {userTeam && squad ? (
          <div className="panel" style={{ padding: 20 }}>
            <div
              className="section-title"
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <span className="dot home" />
              Tactics — {userTeam.name}
              {tacticsSubmitted && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 11,
                    color: "var(--ws-green-bright)",
                    letterSpacing: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  ✓ TACTICS CONFIRMED
                </span>
              )}
            </div>

            {tacticsSubmitted && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "rgba(46,204,113,0.08)",
                  border: "1px solid rgba(46,204,113,0.3)",
                  borderRadius: 6,
                  marginBottom: 16,
                  fontSize: 13,
                  color: "var(--ws-green-bright)",
                }}
              >
                ✓ Tactics auto-loaded from your Squad formation. You can still
                adjust below before kick-off.
              </div>
            )}

            <TacticsForm
              fixtureId={fixtureId}
              players={squad}
              onSubmitted={() => setTacticsSubmitted(true)}
            />
            <div
              style={{
                marginTop: 24,
                paddingTop: 20,
                borderTop: "1px solid var(--border)",
              }}
            >
              <KickOffButton
                onClick={handleSimulate}
                simulating={simulating}
                disabled={!tacticsSubmitted}
              />
              {!tacticsSubmitted && (
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--ink-dim)",
                    marginTop: 8,
                  }}
                >
                  Confirm your tactics above to enable kick-off.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="panel" style={{ padding: 20 }}>
            <p style={{ color: "var(--ink-dim)", marginTop: 0 }}>
              Both teams are AI-controlled. Their managers will set tactics
              automatically on kick-off.
            </p>
            <KickOffButton
              onClick={handleSimulate}
              simulating={simulating}
              disabled={false}
            />
          </div>
        )}
        {error && (
          <p style={{ color: "var(--home-color)", marginTop: 12 }}>{error}</p>
        )}
      </div>
    );
  }

  // ---- POST-MATCH / LIVE ----
  const events = data.events ?? [];
  const homeSlots = formationToSlots(data.homeTactics!.formation, "HOME");
  const awaySlots = formationToSlots(data.awayTactics!.formation, "AWAY");

  return (
    <div className="page">
      <BackLink router={router} />

      {/* Scoreboard */}
      <div
        className="panel"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 28,
          padding: "16px 24px",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <TeamTag
          name={data.homeTeam.name}
          color="var(--home-color)"
          isUser={data.homeTeam.isUserControlled}
        />

        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: "2rem",
            fontWeight: 700,
            letterSpacing: 4,
            minWidth: 110,
            textAlign: "center",
          }}
        >
          {liveScore.home} — {liveScore.away}
        </div>

        <TeamTag
          name={data.awayTeam.name}
          color="var(--away-color)"
          isUser={data.awayTeam.isUserControlled}
          reverse
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: "1.1rem",
              color: "var(--accent)",
              background: "rgba(255,209,102,0.08)",
              border: "1px solid rgba(255,209,102,0.3)",
              borderRadius: 4,
              padding: "3px 10px",
              minWidth: 64,
              textAlign: "center",
            }}
          >
            {matchOver ? "FT" : `${liveMinute}'`}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                style={{
                  background: "transparent",
                  border:
                    speed === s
                      ? "1px solid var(--accent)"
                      : "1px solid var(--border)",
                  color: speed === s ? "var(--accent)" : "var(--ink-dim)",
                  fontFamily: "var(--mono)",
                  fontSize: "0.7rem",
                  padding: "2px 8px",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                {s}x
              </button>
            ))}
            <button
              onClick={toggleMute}
              className={`ws-sound-toggle ${!muted ? "active" : ""}`}
              style={{ padding: "2px 8px", fontSize: "0.7rem" }}
              title={muted ? "Unmute sound effects" : "Mute sound effects"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
          </div>
        </div>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 12 }}
      >
        {/* Pitch */}
        <div
          className="panel"
          style={{
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            position: "relative",
          }}
        >
          {goalFlash > 0 && <div key={goalFlash} className="ws-goal-flash" />}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontFamily: "var(--display)",
              fontSize: "0.8rem",
              textTransform: "uppercase",
              letterSpacing: 1.5,
              color: "var(--ink-dim)",
            }}
          >
            <span>2D Match View</span>
            <span
              className={matchOver ? "" : "ws-live-badge"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: matchOver ? "var(--ink-dim)" : undefined,
              }}
            >
              {!matchOver && <span className="live-dot" />}
              {matchOver ? "FULL TIME" : "LIVE"}
            </span>
          </div>
          <PitchView
            events={events}
            homeStartingXI={data.homeTactics!.startingXI}
            awayStartingXI={data.awayTactics!.startingXI}
            homeFormationSlots={homeSlots}
            awayFormationSlots={awaySlots}
            speed={speed}
            onMinuteChange={handleMinuteChange}
            paused={matchOver}
          />
        </div>

        {/* Right panel */}
        <div
          className="panel"
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{ display: "flex", borderBottom: "1px solid var(--border)" }}
          >
            <Tab
              label="Commentary"
              active={activeTab === "commentary"}
              onClick={() => setActiveTab("commentary")}
            />
            <Tab
              label="AI Decision Log"
              active={activeTab === "ai"}
              onClick={() => setActiveTab("ai")}
            />
          </div>

          {activeTab === "commentary" ? (
            <div
              className="scroll-thin"
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 8,
                maxHeight: 480,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {feed.length === 0 && (
                <p
                  style={{ color: "var(--ink-dim)", fontSize: 13, padding: 8 }}
                >
                  Match starting...
                </p>
              )}
              {feed.map((ev, i) => (
                <FeedItem
                  key={i}
                  event={ev}
                  homeTeamName={data.homeTeam.name}
                  awayTeamName={data.awayTeam.name}
                />
              ))}
            </div>
          ) : (
            <div
              className="scroll-thin"
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 14,
                maxHeight: 480,
              }}
            >
              <DecisionCard
                teamName={data.homeTeam.name}
                color="var(--home-color)"
                tactics={data.homeTactics!}
              />
              <DecisionCard
                teamName={data.awayTeam.name}
                color="var(--away-color)"
                tactics={data.awayTactics!}
              />
            </div>
          )}
        </div>
      </div>

      {/* EXP Popup */}
      {/* Half-time formation change modal — poin 5 */}
      {showHalfTimeModal && (
        <HalfTimeModal
          currentFormation={halfTimeFormation}
          onConfirm={(formation) => {
            setHalfTimeFormation(formation);
            setShowHalfTimeModal(false);
          }}
          onSkip={() => setShowHalfTimeModal(false)}
        />
      )}

      {expPopup && (
        <ExpResultPopup
          {...expPopup}
          onClose={() => setExpPopup(null)}
          onContinue={() => router.push("/")}
        />
      )}
    </div>
  );
}

function BackLink({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <button onClick={() => router.push("/")} className="ws-back-button">
      <span className="ws-back-icon">🏆</span>
      <span>Back to League</span>
      <span className="ws-back-arrow">→</span>
    </button>
  );
}

function KickOffButton({
  onClick,
  simulating,
  disabled,
}: {
  onClick: () => void;
  simulating: boolean;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={simulating || disabled}
      style={{
        padding: "12px 28px",
        borderRadius: 6,
        border: "none",
        background: disabled ? "var(--border)" : "var(--accent)",
        color: disabled ? "var(--ink-dim)" : "#0a0d12",
        fontWeight: 700,
        fontFamily: "var(--display)",
        textTransform: "uppercase",
        letterSpacing: 1.5,
        fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {simulating ? "Simulating..." : "Kick Off"}
    </button>
  );
}

function TeamTag({
  name,
  color,
  isUser,
  reverse,
}: {
  name: string;
  color: string;
  isUser: boolean;
  reverse?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: reverse ? "row-reverse" : "row",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--display)",
        fontSize: "1.3rem",
        letterSpacing: 0.5,
        textTransform: "uppercase",
      }}
    >
      <span
        className="dot"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      {isUser && (
        <span style={{ color: "var(--accent)", fontSize: "1rem" }}>★</span>
      )}
      {name}
    </div>
  );
}

function Tab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        padding: 10,
        textAlign: "center",
        fontFamily: "var(--display)",
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: 1,
        color: active ? "var(--accent)" : "var(--ink-dim)",
        borderBottom: active
          ? "2px solid var(--accent)"
          : "2px solid transparent",
        background: active ? "rgba(255,209,102,0.05)" : "transparent",
        cursor: "pointer",
      }}
    >
      {label}
    </div>
  );
}

function FeedItem({
  event,
  homeTeamName,
  awayTeamName,
}: {
  event: MatchEvent;
  homeTeamName: string;
  awayTeamName: string;
}) {
  const teamName = event.team === "HOME" ? homeTeamName : awayTeamName;
  const color =
    event.team === "HOME" ? "var(--home-color)" : "var(--away-color)";
  const isGoal = event.type === "GOAL";

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: 8,
        borderRadius: 4,
        fontSize: 13,
        alignItems: "flex-start",
        background: isGoal ? "rgba(255,209,102,0.08)" : "transparent",
        borderLeft: isGoal
          ? "2px solid var(--accent)"
          : "2px solid transparent",
      }}
    >
      <span
        style={{
          fontFamily: "var(--mono)",
          color: "var(--ink-dim)",
          fontSize: 12,
          minWidth: 28,
          paddingTop: 1,
        }}
      >
        {event.minute}'
      </span>
      <span style={{ width: 18, textAlign: "center" }}>
        {EVENT_ICONS[event.type] ?? "•"}
      </span>
      <span style={{ lineHeight: 1.4 }}>
        {event.type !== "HALF_TIME" && event.type !== "FULL_TIME" && (
          <span style={{ fontWeight: 600, color }}>{teamName}</span>
        )}{" "}
        — {EVENT_LABELS[event.type] ?? event.type}
      </span>
    </div>
  );
}

function DecisionCard({
  teamName,
  color,
  tactics,
}: {
  teamName: string;
  color: string;
  tactics: TacticsResult;
}) {
  const isUser = tactics.reasoning === "__USER__";

  return (
    <div
      style={{
        background: "var(--panel-bg)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: 12,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: "var(--display)",
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: 1,
            color,
          }}
        >
          {teamName}
        </span>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--accent)",
            background: "rgba(255,209,102,0.1)",
            border: "1px solid rgba(255,209,102,0.25)",
            padding: "2px 8px",
            borderRadius: 10,
          }}
        >
          {tactics.formation} · {tactics.mentality}
        </span>
      </div>
      <p
        style={{
          fontSize: 13,
          color: "var(--ink-dim)",
          lineHeight: 1.5,
          fontStyle: "italic",
        }}
      >
        {isUser ? "These are your tactics for this match." : tactics.reasoning}
      </p>
      <div
        style={{
          display: "flex",
          gap: 14,
          marginTop: 8,
          fontFamily: "var(--mono)",
          fontSize: 12,
          color: "var(--ink-dim)",
          flexWrap: "wrap",
        }}
      >
        <span>
          Pressing:{" "}
          <b style={{ color: "var(--ink)" }}>{tactics.instructions.pressing}</b>
        </span>
        <span>
          Tempo:{" "}
          <b style={{ color: "var(--ink)" }}>{tactics.instructions.tempo}</b>
        </span>
        <span>
          Width:{" "}
          <b style={{ color: "var(--ink)" }}>{tactics.instructions.width}</b>
        </span>
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
        height: "100vh",
        color: "var(--ink)",
      }}
    >
      {children}
    </div>
  );
}

// ─── Half-Time Formation Modal ────────────────────────────────────────────────

const FORMATION_LIST = [
  "4-4-2",
  "4-3-3",
  "4-2-3-1",
  "3-5-2",
  "5-3-2",
  "4-5-1",
  "4-4-1-1",
  "4-3-1-2",
] as const;

function HalfTimeModal({
  currentFormation,
  onConfirm,
  onSkip,
}: {
  currentFormation: string;
  onConfirm: (formation: string) => void;
  onSkip: () => void;
}) {
  const [selected, setSelected] = useState(currentFormation);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <div
        onClick={onSkip}
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
            : "translate(-50%,-50%) scale(0.9)",
          zIndex: 301,
          width: "min(420px, 90vw)",
          background: "linear-gradient(160deg, #0d1117, #0a0d12)",
          border: "1px solid rgba(79,195,247,0.3)",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow:
            "0 0 40px rgba(79,195,247,0.15), 0 20px 50px rgba(0,0,0,0.6)",
          opacity: visible ? 1 : 0,
          transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div
          style={{
            height: 3,
            background:
              "linear-gradient(90deg, transparent, #4fc3f7, transparent)",
          }}
        />
        <div style={{ padding: "24px 22px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 28 }}>⏱</span>
            <div>
              <div
                style={{
                  fontFamily: "var(--display)",
                  fontSize: "1.2rem",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "#4fc3f7",
                }}
              >
                Half Time
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>
                Adjust your formation for the second half
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 18,
            }}
          >
            {FORMATION_LIST.map((f) => (
              <button
                key={f}
                onClick={() => setSelected(f)}
                style={{
                  padding: "10px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background:
                    selected === f
                      ? "rgba(79,195,247,0.15)"
                      : "var(--panel-bg)",
                  border:
                    selected === f
                      ? "1px solid rgba(79,195,247,0.6)"
                      : "1px solid var(--border)",
                  color: selected === f ? "#4fc3f7" : "var(--ink)",
                  fontFamily: "var(--mono)",
                  fontSize: 14,
                  fontWeight: selected === f ? 700 : 400,
                  transition: "all 0.12s",
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onSkip}
              style={{
                flex: 1,
                padding: "11px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--ink-dim)",
                cursor: "pointer",
                fontFamily: "var(--display)",
                fontSize: 12,
                textTransform: "uppercase",
              }}
            >
              Keep Current
            </button>
            <button
              onClick={() => {
                setVisible(false);
                setTimeout(() => onConfirm(selected), 250);
              }}
              style={{
                flex: 2,
                padding: "11px",
                borderRadius: 8,
                border: "none",
                background: "#4fc3f7",
                color: "#0a0d12",
                cursor: "pointer",
                fontFamily: "var(--display)",
                fontWeight: 700,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              ✓ Apply {selected}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── EXP Result Popup ─────────────────────────────────────────────────────────

const RESULT_CONFIG = {
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

function ExpResultPopup({
  result,
  expGained,
  newExp,
  newLevel,
  mvpName,
  onClose,
  onContinue,
}: {
  result: "WIN" | "DRAW" | "LOSS";
  expGained: number;
  newExp: number;
  newLevel: number;
  leveledUp: boolean;
  mvpName: string | null;
  onClose: () => void;
  onContinue: () => void;
}) {
  const cfg = RESULT_CONFIG[result];
  const [visible, setVisible] = useState(false);
  const [showEXP, setShowEXP] = useState(false);
  const [showMVP, setShowMVP] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 50);
    const t2 = setTimeout(() => setShowEXP(true), 600);
    const t3 = setTimeout(() => setShowMVP(true), 1000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  function handleContinue() {
    setVisible(false);
    setTimeout(onContinue, 300);
  }

  return (
    <>
      <div
        onClick={handleContinue}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 300,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(6px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      />

      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: visible
            ? "translate(-50%, -50%) scale(1)"
            : "translate(-50%, -50%) scale(0.85)",
          zIndex: 301,
          width: "min(440px, 92vw)",
          background: "linear-gradient(160deg, #0d1117 0%, #0a0d12 100%)",
          border: `1px solid ${cfg.color}44`,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: `0 0 60px ${cfg.glow}, 0 24px 64px rgba(0,0,0,0.7)`,
          opacity: visible ? 1 : 0,
          transition: "all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {/* Top glow strip */}
        <div
          style={{
            height: 3,
            background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`,
            boxShadow: `0 0 20px ${cfg.glow}`,
          }}
        />

        {/* Floating particles for WIN */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          {result === "WIN" &&
            Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${8 + ((i * 8) % 84)}%`,
                  top: `${10 + ((i * 13) % 70)}%`,
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background:
                    i % 3 === 0 ? "#ffd700" : i % 3 === 1 ? "#fff" : "#4fc3f7",
                  opacity: 0.6,
                  animation: `exp-float ${1.5 + (i % 4) * 0.4}s ease-in-out ${i * 0.15}s infinite alternate`,
                }}
              />
            ))}
        </div>

        <div
          style={{
            padding: "32px 28px 28px",
            textAlign: "center",
            position: "relative",
          }}
        >
          {/* Result emoji */}
          <div
            style={{
              fontSize: 72,
              filter: `drop-shadow(0 0 24px ${cfg.glow})`,
              animation:
                "exp-bounce 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s both",
            }}
          >
            {cfg.emoji}
          </div>

          <div style={{ marginTop: 8, marginBottom: 4 }}>
            <span
              style={{
                display: "inline-block",
                padding: "4px 16px",
                borderRadius: 20,
                background: `${cfg.color}18`,
                border: `1px solid ${cfg.color}55`,
                color: cfg.color,
                fontSize: 11,
                fontFamily: "var(--display)",
                textTransform: "uppercase",
                letterSpacing: 3,
              }}
            >
              World Stage 2026
            </span>
          </div>

          <h2
            style={{
              fontFamily: "var(--display)",
              fontSize: "2.2rem",
              textTransform: "uppercase",
              letterSpacing: 2,
              color: cfg.color,
              margin: "10px 0 24px",
              textShadow: `0 0 30px ${cfg.glow}`,
            }}
          >
            {cfg.label}
          </h2>

          {/* EXP gained */}
          <div
            style={{
              opacity: showEXP ? 1 : 0,
              transform: showEXP ? "translateY(0)" : "translateY(16px)",
              transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "16px 20px",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ink-dim)",
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  marginBottom: 10,
                }}
              >
                Manager EXP Gained
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "2.6rem",
                  fontWeight: 700,
                  color: cfg.color,
                  textShadow: `0 0 20px ${cfg.glow}`,
                  letterSpacing: 1,
                }}
              >
                +{expGained}{" "}
                <span
                  style={{
                    fontSize: "1rem",
                    color: "var(--ink-dim)",
                    fontFamily: "var(--display)",
                    textTransform: "uppercase",
                  }}
                >
                  EXP
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    color: "var(--ink-dim)",
                    marginBottom: 4,
                  }}
                >
                  <span>Level {newLevel}</span>
                  <span>{newExp} EXP total</span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: "rgba(255,255,255,0.06)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, (newExp % 500) / 5)}%`,
                      background: `linear-gradient(90deg, ${cfg.color}88, ${cfg.color})`,
                      borderRadius: 3,
                      transition: "width 1s ease 0.8s",
                      boxShadow: `0 0 8px ${cfg.glow}`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* MVP */}
          {mvpName && (
            <div
              style={{
                opacity: showMVP ? 1 : 0,
                transform: showMVP ? "translateY(0)" : "translateY(12px)",
                transition: "all 0.4s ease",
                background: "rgba(255,215,0,0.06)",
                border: "1px solid rgba(255,215,0,0.2)",
                borderRadius: 10,
                padding: "12px 16px",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 22 }}>⭐</span>
              <div style={{ textAlign: "left" }}>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--ink-dim)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Man of the Match
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontFamily: "var(--display)",
                    color: "var(--ws-gold)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  {mvpName}
                </div>
              </div>
              <div
                style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  color: "var(--ws-gold)",
                  fontFamily: "var(--mono)",
                }}
              >
                +50 Player EXP
              </div>
            </div>
          )}

          {/* Close */}
          <button
            onClick={handleContinue}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: 10,
              border: "none",
              background: `linear-gradient(135deg, ${cfg.color}cc, ${cfg.color})`,
              color: "#0a0d12",
              fontFamily: "var(--display)",
              fontWeight: 700,
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: 2,
              cursor: "pointer",
              boxShadow: `0 4px 20px ${cfg.glow}`,
              marginTop: 4,
            }}
          >
            🏆 Continue to League
          </button>
        </div>

        <div
          style={{
            height: 2,
            background: `linear-gradient(90deg, transparent, ${cfg.color}66, transparent)`,
          }}
        />
      </div>

      <style>{`
        @keyframes exp-bounce {
          from { transform: scale(0.3); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes exp-float {
          from { transform: translateY(0) rotate(0deg);   opacity: 0.3; }
          to   { transform: translateY(-12px) rotate(180deg); opacity: 0.8; }
        }
      `}</style>
    </>
  );
}
