"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import AuthWall from "@/components/auth/AuthWall";

export default function MatchmakingPage() {
  return <AuthWall><MatchmakingContent /></AuthWall>;
}

function MatchmakingContent() {
  const { walletAddress } = useAuth();
  const router = useRouter();

  const [status, setStatus] = useState<"idle"|"waiting"|"league_created">("idle");
  const [queuePos, setQueuePos] = useState(0);
  const [inQueue, setInQueue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if already in queue on load
  useEffect(() => {
    if (!walletAddress) return;
    fetch(`/api/matchmaking?wallet=${walletAddress}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "waiting") {
          setStatus("waiting");
          setQueuePos(data.queuePosition);
          setInQueue(data.playersInQueue);
        } else if (data.status === "league_created") {
          router.push("/");
        }
      })
      .catch(() => {});
  }, [walletAddress, router]);

  // Poll every 3s while waiting
  useEffect(() => {
    if (status !== "waiting" || !walletAddress) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/matchmaking?wallet=${walletAddress}`);
        const data = await res.json();
        if (data.status === "league_created") {
          setStatus("league_created");
          clearInterval(interval);
          setTimeout(() => router.push("/"), 2000);
        } else if (data.status === "waiting") {
          setQueuePos(data.queuePosition);
          setInQueue(data.playersInQueue);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [status, walletAddress, router]);

  async function joinQueue() {
    if (!walletAddress) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/matchmaking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solanaWallet: walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      if (data.status === "league_created") {
        setStatus("league_created");
        setTimeout(() => router.push("/"), 2000);
      } else if (data.status === "waiting") {
        setStatus("waiting");
        setQueuePos(data.queuePosition);
        setInQueue(data.playersInQueue);
      } else if (data.status === "in_league") {
        router.push("/");
      }
    } catch {
      setError("Failed to join queue");
    } finally {
      setLoading(false);
    }
  }

  const filledSlots = status === "waiting" ? inQueue : 0;

  return (
    <div className="page" style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
      <div className="ws-hero">
        <div className="ws-badge"><span className="pulse-ball" />Matchmaking</div>
        <h1 className="ws-title">Find a League</h1>
        <p className="ws-subtitle">
          Real managers only. League starts when all 8 slots are filled.
        </p>
      </div>

      <div className="panel" style={{ padding: 28, marginBottom: 20 }}>
        {/* 8 slots visual */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
          {Array.from({ length: 8 }, (_, i) => {
            const filled = i < filledSlots;
            const isMe = i === queuePos - 1;
            return (
              <div key={i} style={{
                height: 72, borderRadius: 10,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 4,
                background: filled
                  ? isMe ? "rgba(255,215,0,0.12)" : "rgba(46,204,113,0.08)"
                  : "rgba(255,255,255,0.03)",
                border: `2px solid ${filled
                  ? isMe ? "rgba(255,215,0,0.6)" : "rgba(46,204,113,0.35)"
                  : "var(--border)"}`,
                transition: "all 0.3s",
              }}>
                <span style={{ fontSize: 22 }}>
                  {filled ? (isMe ? "🌟" : "✅") : "👤"}
                </span>
                <span style={{
                  fontSize: 8, textTransform: "uppercase", letterSpacing: 1,
                  color: filled
                    ? isMe ? "var(--ws-gold)" : "var(--ws-green-bright)"
                    : "var(--ink-dim)",
                }}>
                  {filled ? (isMe ? "You" : "Joined") : "Open"}
                </span>
              </div>
            );
          })}
        </div>

        {status === "idle" && (
          <>
            <p style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 20, lineHeight: 1.7 }}>
              No AI opponents — every team is managed by a real person.
              Your club and squad from previous seasons carry over.
            </p>
            <button onClick={joinQueue} disabled={loading} style={{
              width: "100%", padding: "14px", borderRadius: 10, border: "none",
              background: loading ? "var(--border)" : "var(--ws-gold)",
              color: loading ? "var(--ink-dim)" : "#0a0d12",
              fontFamily: "var(--display)", fontWeight: 700,
              fontSize: 15, textTransform: "uppercase", letterSpacing: 2,
              cursor: loading ? "not-allowed" : "pointer",
            }}>
              {loading ? "Joining..." : "⚽ Join Queue"}
            </button>
          </>
        )}

        {status === "waiting" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: "2.5rem", fontWeight: 700, color: "var(--ws-gold)" }}>
              {inQueue} <span style={{ fontSize: "1rem", color: "var(--ink-dim)" }}>/ 8</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-dim)" }}>
              Waiting for <strong style={{ color: "var(--ink)" }}>{8 - inQueue} more</strong> manager{8 - inQueue !== 1 ? "s" : ""}...
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-dim)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ animation: "ws-float 1s ease-in-out infinite", display: "inline-block" }}>⏳</span>
              Auto-checking every 3 seconds
            </div>
            <div style={{ marginTop: 8, padding: "10px 16px", background: "rgba(255,255,255,0.04)", borderRadius: 8, fontSize: 11, color: "var(--ink-dim)", width: "100%" }}>
              Share link with friends:<br />
              <span style={{ fontFamily: "var(--mono)", color: "var(--ws-gold)", wordBreak: "break-all" }}>
                {typeof window !== "undefined" ? `${window.location.origin}/matchmaking` : "/matchmaking"}
              </span>
            </div>
          </div>
        )}

        {status === "league_created" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 52, animation: "exp-bounce 0.5s ease both" }}>🏆</div>
            <div style={{ fontFamily: "var(--display)", fontSize: "1.3rem", color: "var(--ws-gold)", textTransform: "uppercase", letterSpacing: 1 }}>
              League Created!
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-dim)" }}>
              All 8 managers ready. Redirecting to your league...
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 6, background: "rgba(255,82,82,0.1)", border: "1px solid rgba(255,82,82,0.3)", color: "#ff5252", fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
