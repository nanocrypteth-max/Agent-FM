"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import AuthWall from "@/components/auth/AuthWall";
import { useHoverSound } from "@/lib/sound/useHoverSound";

interface Lobby {
  id: string;
  code: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  hostTeam: { name: string; logoSvg: string | null; jerseyColor: string };
}

export default function FriendlyPage() {
  return (
    <AuthWall>
      <FriendlyContent />
    </AuthWall>
  );
}

function FriendlyContent() {
  const { walletAddress } = useAuth();
  const router = useRouter();
  const ctaHover = useHoverSound("cta");
  const subtleHover = useHoverSound("subtle");

  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLobbies();
    // Auto-refresh every 10s so new lobbies from friends appear without manual refresh
    const interval = setInterval(loadLobbies, 10_000);
    return () => clearInterval(interval);
  }, []);

  async function loadLobbies() {
    setLoading(true);
    const res = await fetch("/api/friendly");
    if (res.ok) {
      const data = await res.json();
      setLobbies(data.lobbies);
    }
    setLoading(false);
  }

  async function createLobby() {
    setCreating(true);
    setError(null);
    const res = await fetch("/api/friendly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solanaWallet: walletAddress }),
    });
    const data = await res.json();
    if (res.ok) {
      router.push(`/friendly/${data.code}`);
    } else {
      setError(data.error);
      setCreating(false);
    }
  }

  async function joinLobby() {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError("Enter a valid 6-character code");
      return;
    }
    setError(null);

    const res = await fetch(`/api/friendly/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solanaWallet: walletAddress }),
    });
    const data = await res.json();
    if (res.ok) {
      router.push(`/friendly/${code}`);
    } else {
      setError(data.error);
    }
  }

  return (
    <div className="page">
      <div className="ws-hero" style={{ marginBottom: 20 }}>
        <div className="ws-badge">
          <span className="pulse-ball" />
          PvP
        </div>
        <h1 className="ws-title">Friendly Matches</h1>
        <p className="ws-subtitle">
          Challenge other managers to a friendly match. Create a lobby and share
          your 6-character code, or join an existing match.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Create Lobby */}
        <div
          className="panel"
          style={{
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div className="section-title">Create Lobby</div>
          <p style={{ fontSize: 13, color: "var(--ink-dim)", lineHeight: 1.6 }}>
            Start a new lobby and share the 6-character code with a friend.
            Lobby expires in 30 minutes if no one joins.
          </p>
          <button
            onClick={createLobby}
            disabled={creating}
            {...ctaHover}
            style={{
              padding: "12px",
              borderRadius: 8,
              border: "none",
              background: creating ? "var(--border)" : "var(--ws-gold)",
              color: creating ? "var(--ink-dim)" : "#0a0d12",
              fontFamily: "var(--display)",
              fontWeight: 700,
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              cursor: creating ? "not-allowed" : "pointer",
            }}
          >
            {creating ? "Creating..." : "⚽ Create Lobby"}
          </button>
        </div>

        {/* Join Lobby */}
        <div
          className="panel"
          style={{
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div className="section-title">Join Lobby</div>
          <p style={{ fontSize: 13, color: "var(--ink-dim)", lineHeight: 1.6 }}>
            Enter the 6-character code shared by your opponent.
          </p>
          <input
            value={joinCode}
            onChange={(e) =>
              setJoinCode(e.target.value.toUpperCase().slice(0, 6))
            }
            placeholder="ABCDEF"
            style={{
              padding: "12px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--panel-bg)",
              color: "var(--ink)",
              fontFamily: "var(--mono)",
              fontSize: 20,
              letterSpacing: 4,
              textAlign: "center",
              textTransform: "uppercase",
            }}
          />
          <button
            onClick={joinLobby}
            {...ctaHover}
            style={{
              padding: "12px",
              borderRadius: 8,
              border: "none",
              background:
                joinCode.length === 6 ? "var(--away-color)" : "var(--border)",
              color: joinCode.length === 6 ? "#0a0d12" : "var(--ink-dim)",
              fontFamily: "var(--display)",
              fontWeight: 700,
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              cursor: joinCode.length === 6 ? "pointer" : "not-allowed",
            }}
          >
            Join Match
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: 6,
            background: "rgba(255,82,82,0.1)",
            border: "1px solid #ff5252",
            color: "#ff5252",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* Open Lobbies */}
      <div className="section-title">Open Lobbies</div>
      {loading ? (
        <Centered>Loading...</Centered>
      ) : lobbies.length === 0 ? (
        <div
          className="panel"
          style={{ padding: 32, textAlign: "center", color: "var(--ink-dim)" }}
        >
          No open lobbies. Create one and invite a friend!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lobbies.map((lobby) => (
            <div
              key={lobby.id}
              className="panel ws-fixture-row"
              {...subtleHover}
              style={{
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              {lobby.hostTeam.logoSvg && (
                <div
                  style={{ width: 40, flexShrink: 0 }}
                  dangerouslySetInnerHTML={{ __html: lobby.hostTeam.logoSvg }}
                />
              )}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: "var(--display)",
                    fontSize: "1rem",
                    textTransform: "uppercase",
                  }}
                >
                  {lobby.hostTeam.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 2,
                  }}
                >
                  Expires {new Date(lobby.expiresAt).toLocaleTimeString()}
                </div>
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "1.4rem",
                  letterSpacing: 4,
                  color: "var(--ws-gold)",
                }}
              >
                {lobby.code}
              </div>
              <button
                onClick={() => {
                  setJoinCode(lobby.code);
                  joinLobby();
                }}
                {...ctaHover}
                style={{
                  padding: "8px 18px",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--ws-gold)",
                  color: "#0a0d12",
                  fontFamily: "var(--display)",
                  fontWeight: 700,
                  fontSize: 12,
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Join
              </button>
            </div>
          ))}
        </div>
      )}
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
        padding: 48,
        color: "var(--ink)",
      }}
    >
      {children}
    </div>
  );
}
