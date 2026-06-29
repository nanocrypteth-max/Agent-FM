"use client";

import { useState } from "react";
import { useSolanaWallets } from "@privy-io/react-auth";
import { useAuth } from "@/lib/auth/useAuth";
import { useHoverSound } from "@/lib/sound/useHoverSound";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import LandingPage from "@/components/auth/LandingPage";

const TREASURY_WALLET = process.env.NEXT_PUBLIC_SOLANA_TREASURY ?? "";
const STANDARD_PRICE_SOL = 0.01;
const PREMIUM_PRICE_SOL = 0.05;
const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

interface SpinResult {
  player: {
    name: string;
    position: string;
    starRating: number;
    avatarSvg: string;
    pace: number;
    shooting: number;
    passing: number;
    defending: number;
    stamina: number;
  };
  tier: string;
}

export default function GachaPage() {
  const { connected, walletAddress, session } = useAuth();
  if (!connected) return <LandingPage />;
  return <GachaContent walletAddress={walletAddress!} />;
}

function GachaContent({ walletAddress }: { walletAddress: string }) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [packOpen, setPackOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spinHistory, setSpinHistory] = useState<SpinResult[]>([]);
  const [animating, setAnimating] = useState(false);
  const { wallets } = useSolanaWallets();
  const ctaHover = useHoverSound("cta");
  const subtleHover = useHoverSound("subtle");

  const treasuryMissing = !TREASURY_WALLET;

  async function handleSpin(tier: "STANDARD" | "PREMIUM") {
    setSpinning(true);
    setAnimating(true);
    setError(null);
    setResult(null);
    setPackOpen(false);

    try {
      const privyWallet = wallets[0];
      if (!privyWallet) throw new Error("No wallet found. Please reconnect.");

      const connection = new Connection(RPC_URL, "confirmed");
      const priceSol =
        tier === "STANDARD" ? STANDARD_PRICE_SOL : PREMIUM_PRICE_SOL;
      const lamports = Math.round(priceSol * LAMPORTS_PER_SOL);

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(walletAddress),
          toPubkey: new PublicKey(TREASURY_WALLET),
          lamports,
        }),
      );

      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(walletAddress);

      // Sign and send via Privy wallet (works for email/embedded and Phantom)
      const signature = await privyWallet.sendTransaction(tx, connection);

      const res = await fetch("/api/gacha/verify-spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: signature,
          tier,
          walletAddr: walletAddress,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");

      setTimeout(() => {
        setResult({ player: data.player, tier });
        setPackOpen(false); // show sealed pack first
        setSpinHistory((prev) => [
          { player: data.player, tier },
          ...prev.slice(0, 9),
        ]);
        setAnimating(false);
      }, 1500);
    } catch (e: any) {
      setError(e.message ?? "Transaction failed");
      setAnimating(false);
    } finally {
      setSpinning(false);
    }
  }

  return (
    <div className="page">
      <div className="ws-hero" style={{ marginBottom: 20 }}>
        <div className="ws-badge">
          <span className="pulse-ball" />
          Solana · Devnet
        </div>
        <h1 className="ws-title">Player Scout</h1>
        <p className="ws-subtitle">
          Spin the capsule to discover rare players. Powered by Phantom on
          Solana.
        </p>
      </div>

      {treasuryMissing && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 6,
            background: "rgba(255,152,0,0.1)",
            border: "1px solid #ff9800",
            marginBottom: 16,
            fontSize: 13,
            color: "#ff9800",
          }}
        >
          ⚠️ <code>NEXT_PUBLIC_SOLANA_TREASURY</code> not set in .env
        </div>
      )}

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Wallet status */}
          <div
            className="panel"
            style={{
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--ws-green-bright)",
                boxShadow: "0 0 8px var(--ws-green-bright)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12,
                color: "var(--ink-dim)",
              }}
            >
              {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--ws-green-bright)",
                marginLeft: "auto",
              }}
            >
              Phantom Connected
            </span>
          </div>

          {/* Capsule cards */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <CapsuleCard
              tier="STANDARD"
              price={`${STANDARD_PRICE_SOL} SOL`}
              starRange="★ to ★★★"
              color="var(--away-color)"
              emoji="🔵"
              rates={["50% ★", "30% ★★", "20% ★★★"]}
              onSpin={() => handleSpin("STANDARD")}
              disabled={spinning || treasuryMissing}
              hover={ctaHover}
            />
            <CapsuleCard
              tier="PREMIUM"
              price={`${PREMIUM_PRICE_SOL} SOL`}
              starRange="★★★ to ★★★★★"
              color="var(--ws-gold)"
              emoji="🌟"
              rates={["40% ★★★", "40% ★★★★", "20% ★★★★★"]}
              onSpin={() => handleSpin("PREMIUM")}
              disabled={spinning || treasuryMissing}
              hover={ctaHover}
            />
          </div>

          {/* Pack result with open animation */}
          {(animating || result) && (
            <div
              className="panel"
              style={{
                padding: 32,
                textAlign: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {animating ? (
                <div style={{ padding: 24 }}>
                  <div
                    style={{
                      fontSize: 64,
                      animation: "ws-spin 0.4s linear infinite",
                      display: "inline-block",
                    }}
                  >
                    📦
                  </div>
                  <div
                    style={{
                      marginTop: 16,
                      fontFamily: "var(--display)",
                      textTransform: "uppercase",
                      letterSpacing: 2,
                      color: "var(--ink-dim)",
                    }}
                  >
                    Scouting talent...
                  </div>
                </div>
              ) : result && !packOpen ? (
                /* Sealed pack — click to reveal */
                <div
                  onClick={() => setPackOpen(true)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="ws-goal-flash" key={result.player.name} />
                  <div
                    style={{
                      width: 160,
                      height: 220,
                      margin: "0 auto 16px",
                      background:
                        result.tier === "PREMIUM"
                          ? "linear-gradient(135deg, #1a0a00, #3d1f00, #ffd700)"
                          : "linear-gradient(135deg, #0a1220, #1a2a40, #4fc3f7)",
                      borderRadius: 16,
                      border: `2px solid ${result.tier === "PREMIUM" ? "#ffd700" : "#4fc3f7"}`,
                      boxShadow:
                        result.tier === "PREMIUM"
                          ? "0 0 40px rgba(255,215,0,0.5), 0 0 80px rgba(255,215,0,0.2)"
                          : "0 0 40px rgba(79,195,247,0.4)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      animation: "pack-float 2s ease-in-out infinite",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* Shine sweep */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: "-100%",
                        width: "60%",
                        height: "100%",
                        background:
                          "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
                        animation: "pack-shine 2s ease-in-out infinite",
                      }}
                    />
                    <div style={{ fontSize: 48 }}>
                      {result.tier === "PREMIUM" ? "🌟" : "⚽"}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--display)",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: 2,
                        color:
                          result.tier === "PREMIUM" ? "#ffd700" : "#4fc3f7",
                      }}
                    >
                      {result.tier}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: "rgba(255,255,255,0.5)",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      Tap to open
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-dim)",
                      animation: "pack-pulse 1.5s ease-in-out infinite",
                    }}
                  >
                    👆 Tap the pack to reveal your player!
                  </div>
                  <style>{`
                    @keyframes pack-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
                    @keyframes pack-shine { 0%{left:-100%} 60%,100%{left:150%} }
                    @keyframes pack-pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
                  `}</style>
                </div>
              ) : result && packOpen ? (
                /* Card revealed */
                <div
                  style={{
                    animation:
                      "card-reveal 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--ink-dim)",
                      textTransform: "uppercase",
                      letterSpacing: 2,
                      marginBottom: 16,
                    }}
                  >
                    {result.tier} Pack · New Signing!
                  </div>
                  {/* Player card */}
                  <div
                    style={{
                      width: 200,
                      margin: "0 auto 16px",
                      background:
                        result.player.starRating >= 4
                          ? "linear-gradient(160deg, #1a1000, #3d2800)"
                          : "linear-gradient(160deg, #0a1220, #1a2035)",
                      borderRadius: 14,
                      border: `2px solid ${result.player.starRating >= 5 ? "#ffd700" : result.player.starRating >= 4 ? "#ff9800" : "#4fc3f7"}`,
                      boxShadow:
                        result.player.starRating >= 4
                          ? "0 0 30px rgba(255,152,0,0.4)"
                          : "0 0 20px rgba(79,195,247,0.2)",
                      overflow: "hidden",
                    }}
                  >
                    {/* Card header */}
                    <div
                      style={{
                        padding: "10px 12px 0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 28,
                          fontWeight: 900,
                          color:
                            result.player.starRating >= 4
                              ? "#ffd700"
                              : "#4fc3f7",
                        }}
                      >
                        {Math.round(
                          (result.player.pace +
                            result.player.shooting +
                            result.player.passing +
                            result.player.defending) /
                            4,
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontFamily: "var(--display)",
                            fontSize: 9,
                            color: "rgba(255,255,255,0.5)",
                            textTransform: "uppercase",
                          }}
                        >
                          {result.player.position}
                        </div>
                        <div style={{ color: "#ffd700", fontSize: 14 }}>
                          {"★".repeat(result.player.starRating)}
                        </div>
                      </div>
                    </div>
                    {/* Avatar */}
                    <div
                      style={{ width: 140, margin: "8px auto 4px" }}
                      dangerouslySetInnerHTML={{
                        __html: result.player.avatarSvg ?? "",
                      }}
                    />
                    {/* Name bar */}
                    <div
                      style={{
                        background: "rgba(0,0,0,0.4)",
                        padding: "8px 12px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--display)",
                          fontSize: "0.95rem",
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          color: "#fff",
                        }}
                      >
                        {result.player.name}
                      </div>
                    </div>
                    {/* Stats */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 0,
                        borderTop: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      {(
                        [
                          ["PAC", result.player.pace],
                          ["SHO", result.player.shooting],
                          ["PAS", result.player.passing],
                          ["DEF", result.player.defending],
                        ] as [string, number][]
                      ).map(([l, v]) => (
                        <div
                          key={l}
                          style={{
                            padding: "8px 4px",
                            textAlign: "center",
                            borderRight: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <div
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 16,
                              fontWeight: 700,
                              color: statColor(v),
                            }}
                          >
                            {v}
                          </div>
                          <div
                            style={{
                              fontSize: 8,
                              color: "rgba(255,255,255,0.4)",
                              textTransform: "uppercase",
                            }}
                          >
                            {l}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                    Added to your squad ✓
                  </div>
                  <style>{`
                    @keyframes card-reveal {
                      from { transform: rotateY(90deg) scale(0.8); opacity: 0; }
                      to   { transform: rotateY(0deg) scale(1); opacity: 1; }
                    }
                  `}</style>
                </div>
              ) : null}
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "10px 16px",
                borderRadius: 6,
                background: "rgba(255,82,82,0.1)",
                border: "1px solid #ff5252",
                fontSize: 13,
                color: "#ff5252",
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* History */}
        <div>
          <div className="section-title">Recent Pulls</div>
          {spinHistory.length === 0 ? (
            <div
              className="panel"
              style={{
                padding: 24,
                textAlign: "center",
                color: "var(--ink-dim)",
                fontSize: 13,
              }}
            >
              Spin to see your pulls here.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {spinHistory.map((h, i) => (
                <div
                  key={i}
                  className="panel"
                  {...subtleHover}
                  style={{
                    padding: "10px 14px",
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{ width: 40, flexShrink: 0 }}
                    dangerouslySetInnerHTML={{
                      __html: h.player.avatarSvg ?? "",
                    }}
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
                      {h.player.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ws-gold)" }}>
                      {"★".repeat(h.player.starRating)}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--ink-dim)",
                      padding: "2px 6px",
                      borderRadius: 3,
                      background: "var(--panel-bg)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {h.player.position}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes ws-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function CapsuleCard({
  tier,
  price,
  starRange,
  color,
  emoji,
  rates,
  onSpin,
  disabled,
  hover,
}: {
  tier: string;
  price: string;
  starRange: string;
  color: string;
  emoji: string;
  rates: string[];
  onSpin: () => void;
  disabled: boolean;
  hover: ReturnType<typeof useHoverSound>;
}) {
  return (
    <div
      className="panel"
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        border: `1px solid ${color}44`,
        background: `${color}08`,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>{emoji}</div>
        <div
          style={{
            fontFamily: "var(--display)",
            fontSize: "1.1rem",
            textTransform: "uppercase",
            letterSpacing: 1,
            color,
          }}
        >
          {tier}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2 }}>
          {starRange}
        </div>
      </div>
      <div
        style={{
          background: "var(--panel-bg)",
          borderRadius: 6,
          padding: "8px 12px",
        }}
      >
        {rates.map((r) => (
          <div
            key={r}
            style={{
              fontSize: 11,
              color: "var(--ink-dim)",
              padding: "2px 0",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>{r.split(" ")[1]}</span>
            <span style={{ color: "var(--ws-gold)" }}>{r.split(" ")[0]}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onSpin}
        disabled={disabled}
        {...hover}
        style={{
          padding: 12,
          borderRadius: 8,
          border: "none",
          background: !disabled ? color : "var(--border)",
          color: !disabled ? "#0a0d12" : "var(--ink-dim)",
          fontFamily: "var(--display)",
          fontWeight: 700,
          fontSize: 13,
          textTransform: "uppercase" as const,
          letterSpacing: 1,
          cursor: !disabled ? "pointer" : "not-allowed",
          width: "100%",
        }}
      >
        Spin · {price}
      </button>
    </div>
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
