"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import AuthWall from "@/components/auth/AuthWall";
import { useHoverSound } from "@/lib/sound/useHoverSound";

const TOPUP_PACKS = [
  { id: "starter", sol: 0.1, usd: 1000,  label: "Starter Pack",   emoji: "💵", color: "#4fc3f7" },
  { id: "pro",     sol: 0.5, usd: 5000,  label: "Pro Pack",       emoji: "💰", color: "#ffd700" },
  { id: "elite",   sol: 1.0, usd: 10000, label: "Elite Pack",     emoji: "💎", color: "#ce93d8" },
  { id: "legend",  sol: 5.0, usd: 50000, label: "Legend Pack",    emoji: "👑", color: "#ff9800" },
];

export default function TopupPage() {
  return <AuthWall><TopupContent /></AuthWall>;
}

function TopupContent() {
  const { walletAddress, session, refetch } = useAuth();
  const [buying, setBuying] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const ctaHover = useHoverSound("cta");

  const TREASURY = process.env.NEXT_PUBLIC_SOLANA_TREASURY;

  async function handleTopup(pack: typeof TOPUP_PACKS[0]) {
    if (!walletAddress || !TREASURY) { setMsg({ text: "Wallet not connected", ok: false }); return; }
    setBuying(pack.id);
    setMsg(null);

    try {
      const { Connection, PublicKey, Transaction, SystemProgram } = await import("@solana/web3.js");
      const phantom = (window as any).phantom?.solana ?? (window as any).solana;
      if (!phantom) throw new Error("No wallet found");

      const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
      const lamports = Math.round(pack.sol * 1_000_000_000);

      const tx = new Transaction().add(SystemProgram.transfer({
        fromPubkey: new PublicKey(walletAddress),
        toPubkey: new PublicKey(TREASURY),
        lamports,
      }));
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(walletAddress);

      const { signature } = await phantom.signAndSendTransaction(tx);

      const res = await fetch("/api/currency/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solanaWallet: walletAddress, solAmount: pack.sol, txHash: signature }),
      });
      const data = await res.json();

      if (res.ok) {
        setMsg({ text: `✓ $${pack.usd.toLocaleString()} added to your balance!`, ok: true });
        refetch();
      } else {
        setMsg({ text: data.error, ok: false });
      }
    } catch (e: any) {
      setMsg({ text: e?.message ?? "Transaction failed", ok: false });
    }
    setBuying(null);
  }

  const balance = (session?.usdBalance ?? 0) / 100;

  return (
    <div className="page" style={{ maxWidth: 680, margin: "0 auto" }}>
      <div className="ws-hero">
        <div className="ws-badge"><span className="pulse-ball" />Store</div>
        <h1 className="ws-title">Top Up Balance</h1>
        <p className="ws-subtitle">
          Purchase in-game USD to buy players in the transfer market.
          Rate: <strong style={{ color: "var(--ws-gold)" }}>1 SOL = $10,000</strong>
        </p>
      </div>

      {/* Current balance */}
      <div className="panel" style={{ padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 28 }}>💰</span>
        <div>
          <div style={{ fontSize: 11, color: "var(--ink-dim)", textTransform: "uppercase", letterSpacing: 1 }}>Current Balance</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: "1.8rem", fontWeight: 700, color: "var(--ws-green-bright)" }}>
            ${balance.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Topup packs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginBottom: 20 }}>
        {TOPUP_PACKS.map((pack) => (
          <div key={pack.id} className="panel" style={{
            padding: 24, textAlign: "center",
            border: `1px solid ${pack.color}44`,
            background: `${pack.color}08`,
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${pack.color}, transparent)` }} />
            <div style={{ fontSize: 40, marginBottom: 8 }}>{pack.emoji}</div>
            <div style={{ fontFamily: "var(--display)", fontSize: "1rem", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              {pack.label}
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: "2rem", fontWeight: 700, color: pack.color, marginBottom: 4 }}>
              ${pack.usd.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 16 }}>
              {pack.sol} SOL
            </div>
            <button
              onClick={() => handleTopup(pack)}
              disabled={buying === pack.id}
              {...ctaHover}
              style={{
                width: "100%", padding: "11px", borderRadius: 8, border: "none",
                background: buying === pack.id ? "var(--border)" : pack.color,
                color: buying === pack.id ? "var(--ink-dim)" : "#0a0d12",
                fontFamily: "var(--display)", fontWeight: 700,
                fontSize: 13, textTransform: "uppercase", letterSpacing: 1,
                cursor: buying === pack.id ? "not-allowed" : "pointer",
              }}
            >
              {buying === pack.id ? "Processing..." : `Buy for ${pack.sol} SOL`}
            </button>
          </div>
        ))}
      </div>

      {msg && (
        <div style={{
          padding: "12px 16px", borderRadius: 8, fontSize: 13,
          background: msg.ok ? "rgba(46,204,113,0.1)" : "rgba(255,82,82,0.1)",
          border: `1px solid ${msg.ok ? "rgba(46,204,113,0.3)" : "rgba(255,82,82,0.3)"}`,
          color: msg.ok ? "var(--ws-green-bright)" : "#ff5252",
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 11, color: "var(--ink-dim)", lineHeight: 1.7 }}>
        ℹ️ Transactions are processed on Solana devnet. SOL is sent to the game treasury.
        In-game USD is used exclusively within Agent FM for player transfers.
        It has no real-world monetary value.
      </div>
    </div>
  );
}
