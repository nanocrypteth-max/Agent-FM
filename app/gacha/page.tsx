"use client";

import { useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [spinHistory, setSpinHistory] = useState<SpinResult[]>([]);
  const [animating, setAnimating] = useState(false);
  const ctaHover = useHoverSound("cta");
  const subtleHover = useHoverSound("subtle");

  const treasuryMissing = !TREASURY_WALLET;

  async function handleSpin(tier: "STANDARD" | "PREMIUM") {
    setSpinning(true);
    setAnimating(true);
    setError(null);
    setResult(null);

    try {
      const phantom = (window as any).phantom?.solana ?? (window as any).solana;
      if (!phantom?.isPhantom) throw new Error("Phantom wallet not found");

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

      // Sign and send via Phantom directly
      const { signature } = await phantom.signAndSendTransaction(tx);

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

          {/* Result */}
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
                    ⚽
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
              ) : result ? (
                <>
                  <div className="ws-goal-flash" key={result.player.name} />
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--ink-dim)",
                      textTransform: "uppercase",
                      letterSpacing: 2,
                      marginBottom: 12,
                    }}
                  >
                    {result.tier} Capsule · New Signing!
                  </div>
                  <div
                    style={{ width: 120, margin: "0 auto 12px" }}
                    dangerouslySetInnerHTML={{
                      __html: result.player.avatarSvg ?? "",
                    }}
                  />
                  <div
                    style={{
                      fontFamily: "var(--display)",
                      fontSize: "1.4rem",
                      textTransform: "uppercase",
                    }}
                  >
                    {result.player.name}
                  </div>
                  <div
                    style={{
                      color: "var(--ws-gold)",
                      fontSize: 22,
                      margin: "6px 0",
                    }}
                  >
                    {"★".repeat(result.player.starRating)}
                    {"☆".repeat(5 - result.player.starRating)}
                  </div>
                  <div style={{ color: "var(--ink-dim)", fontSize: 12 }}>
                    {result.player.position} · Added to your squad
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 20,
                      justifyContent: "center",
                      marginTop: 14,
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
                      <div key={l} style={{ textAlign: "center" }}>
                        <div
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 20,
                            fontWeight: 700,
                            color: statColor(v),
                          }}
                        >
                          {v}
                        </div>
                        <div
                          style={{
                            fontSize: 9,
                            color: "var(--ink-dim)",
                            textTransform: "uppercase",
                          }}
                        >
                          {l}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
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
