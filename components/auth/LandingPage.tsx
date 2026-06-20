"use client";

import { useAuth } from "@/lib/auth/useAuth";
import { useHoverSound } from "@/lib/sound/useHoverSound";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { useEffect, useState } from "react";
import Image from "next/image";

const FEATURES = [
  {
    icon: "🤖",
    title: "AI Managers",
    desc: "Every opponent club is managed by an AI agent with its own tactical personality and reasoning.",
  },
  {
    icon: "⚽",
    title: "2D Match View",
    desc: "Watch matches unfold in real-time with FM-style 2D pitch visualization and live commentary.",
  },
  {
    icon: "💰",
    title: "Transfer Market",
    desc: "Scout and sign players, list your own squad members, and build the ultimate team.",
  },
  {
    icon: "🎰",
    title: "Gacha Spin",
    desc: "Spend SOL to spin for rare star players. Standard and Premium capsules available.",
  },
  {
    icon: "📨",
    title: "Manager Portal",
    desc: "Receive AI-generated match news, transfer alerts, and league announcements daily.",
  },
  {
    icon: "🏆",
    title: "Auto Leagues",
    desc: "When a season ends, a new tournament with a unique name and trophy auto-generates.",
  },
];

interface GlobalStats {
  totalClubs: number;
  totalMatches: number;
  totalLeagues: number;
  totalGoals: number;
}

export default function LandingPage() {
  const { login, loading, error, isPhantomInstalled } = useAuth();
  const ctaHover = useHoverSound("cta");
  const subtleHover = useHoverSound("subtle");
  const [stats, setStats] = useState<GlobalStats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {}); // silent fail — stats are decorative, not critical
  }, []);

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      {/* Hero */}
      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "80px 24px 48px",
          position: "relative",
        }}
      >
        {/* Logo */}
        <div
          style={{
            marginBottom: 8,
            filter: "drop-shadow(0 0 40px rgba(255,215,0,0.35))",
            animation: "ws-float 3s ease-in-out infinite",
          }}
        >
          <Image
            src="/logo.png"
            alt={APP_NAME}
            width={340}
            height={144}
            priority
            style={{ width: "min(340px, 80vw)", height: "auto" }}
          />
        </div>

        <div className="ws-badge" style={{ marginBottom: 16 }}>
          <span className="pulse-ball" />
          {APP_TAGLINE} · Season Open
        </div>

        <p
          style={{
            fontSize: "clamp(14px, 2vw, 18px)",
            color: "var(--ink-dim)",
            maxWidth: 520,
            lineHeight: 1.7,
            marginBottom: 40,
          }}
        >
          The world's first football management game where every rival is
          controlled by an AI agent. Connect your Phantom wallet to claim your
          club and start your managerial career.
        </p>

        {/* CTA Button — Privy handles wallet selection (Phantom, email, etc) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <button
            onClick={login}
            disabled={loading}
            {...ctaHover}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "16px 44px",
              borderRadius: 10,
              border: "none",
              background: loading
                ? "var(--border)"
                : "linear-gradient(135deg, var(--ws-gold), #e6b800)",
              color: loading ? "var(--ink-dim)" : "#0a0d12",
              fontFamily: "var(--display)",
              fontWeight: 700,
              fontSize: 16,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 0 40px rgba(255,215,0,0.3)",
            }}
          >
            <span style={{ fontSize: 22 }}>🏆</span>
            {loading ? "Connecting..." : "Connect Wallet / Login"}
          </button>
          <p style={{ fontSize: 12, color: "var(--ink-dim)" }}>
            Connect with Phantom, Solflare, or login with Email
          </p>
        </div>

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 20px",
              borderRadius: 6,
              background: "rgba(255,82,82,0.1)",
              border: "1px solid #ff5252",
              color: "#ff5252",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
      </section>

      {/* Features grid */}
      <section
        style={{
          padding: "48px 24px 80px",
          maxWidth: 1100,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="eyebrow">Why {APP_NAME}</div>
          <h2
            style={{
              fontFamily: "var(--display)",
              fontSize: "1.8rem",
              textTransform: "uppercase",
            }}
          >
            The Future of Football Management
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="panel ws-fixture-row"
              {...subtleHover}
              style={{ padding: 24 }}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
              <h3
                style={{
                  fontFamily: "var(--display)",
                  fontSize: "1rem",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 8,
                  color: "var(--ws-gold)",
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--ink-dim)",
                  lineHeight: 1.6,
                }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Live Global Stats — real data from the platform */}
      {stats && (
        <section
          style={{
            padding: "0 24px 48px",
            maxWidth: 1000,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div className="eyebrow">Across the World Stage</div>
            <h2
              style={{
                fontFamily: "var(--display)",
                fontSize: "1.5rem",
                textTransform: "uppercase",
              }}
            >
              Live Platform Stats
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 14,
            }}
          >
            <LiveStatCard
              icon="🏟️"
              value={stats.totalClubs}
              label="Clubs Founded"
              color="var(--ws-gold)"
            />
            <LiveStatCard
              icon="⚽"
              value={stats.totalMatches}
              label="Matches Played"
              color="var(--away-color)"
            />
            <LiveStatCard
              icon="🥅"
              value={stats.totalGoals}
              label="Goals Scored"
              color="#ff5252"
            />
            <LiveStatCard
              icon="🏆"
              value={stats.totalLeagues}
              label="Leagues Created"
              color="#4fc3f7"
            />
          </div>
        </section>
      )}

      {/* Stats bar */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "20px 24px",
          background: "rgba(10,13,18,0.8)",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            justifyContent: "center",
            gap: 48,
            flexWrap: "wrap",
          }}
        >
          {[
            ["8", "AI Managers"],
            ["5★", "Max Player Rating"],
            ["Solana", "Powered By"],
            ["Free", "To Play"],
          ].map(([val, label]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "1.4rem",
                  fontWeight: 700,
                  color: "var(--ws-gold)",
                }}
              >
                {val}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ink-dim)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes ws-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
      `}</style>
    </div>
  );
}

function LiveStatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: string;
  value: number;
  label: string;
  color: string;
}) {
  const display = useCountUp(value);
  const subtleHover = useHoverSound("subtle");

  return (
    <div
      className="panel"
      {...subtleHover}
      style={{
        padding: "20px 16px",
        textAlign: "center",
        border: `1px solid ${color}33`,
        background: `${color}08`,
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: "1.8rem",
          fontWeight: 700,
          color,
          textShadow: `0 0 16px ${color}44`,
        }}
      >
        {display.toLocaleString()}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--ink-dim)",
          textTransform: "uppercase",
          letterSpacing: 1,
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

/** Animates a number counting up from 0 to target over ~1.2s when it first appears */
function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }
    let raf: number;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      // Ease-out cubic for a natural deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
