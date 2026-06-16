"use client";

import { useEffect, useState } from "react";
import AuthWall from "@/components/auth/AuthWall";

interface Listing {
  id: string;
  price: number;
  listedAt: string;
  player: {
    id: string;
    name: string;
    position: string;
    age: number;
    nationality: string;
    pace: number;
    shooting: number;
    passing: number;
    defending: number;
    stamina: number;
    starRating: number;
    marketValue: number;
    avatarSvg: string;
  };
  fromTeam: { id: string; name: string; logoSvg: string; jerseyColor: string };
}

const POSITIONS = ["ALL", "GK", "DF", "MF", "FW"];

export default function MarketPage() {
  return (
    <AuthWall>
      <MarketContent />
    </AuthWall>
  );
}

function MarketContent() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState("ALL");
  const [minStar, setMinStar] = useState(1);
  const [buying, setBuying] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [budget, setBudget] = useState(0);

  useEffect(() => {
    loadBudget();
    loadListings();
  }, [position, minStar]);

  async function loadBudget() {
    const res = await fetch("/api/squad");
    if (res.ok) {
      const data = await res.json();
      setBudget(data.team?.budget ?? 0);
    }
  }

  async function loadListings() {
    setLoading(true);
    const params = new URLSearchParams();
    if (position !== "ALL") params.set("position", position);
    params.set("minStar", String(minStar));
    const res = await fetch(`/api/market?${params}`);
    const data = await res.json();
    setListings(data.listings ?? []);
    setLoading(false);
  }

  async function handleBuy(listingId: string) {
    setBuying(listingId);
    setMsg(null);
    const res = await fetch(`/api/market/buy/${listingId}`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setMsg({
        text: `✓ ${data.player} signed! Remaining budget: £${data.remainingBudget.toLocaleString()}`,
        ok: true,
      });
      setBudget(data.remainingBudget);
      setListings((prev) => prev.filter((l) => l.id !== listingId));
    } else {
      setMsg({ text: data.error, ok: false });
    }
    setBuying(null);
  }

  return (
    <div className="page">
      <div className="ws-hero" style={{ marginBottom: 20 }}>
        <div className="ws-badge">
          <span className="pulse-ball" />
          Transfer Market
        </div>
        <h1 className="ws-title">Player Market</h1>
        <p className="ws-subtitle">
          Browse and sign players from across the league. Budget:{" "}
          <span style={{ color: "var(--ws-gold)", fontFamily: "var(--mono)" }}>
            £{budget.toLocaleString()}
          </span>
        </p>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {POSITIONS.map((p) => (
          <button
            key={p}
            onClick={() => setPosition(p)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: "1px solid",
              borderColor: position === p ? "var(--ws-gold)" : "var(--border)",
              background:
                position === p ? "rgba(255,215,0,0.1)" : "transparent",
              color: position === p ? "var(--ws-gold)" : "var(--ink-dim)",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "var(--display)",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {p}
          </button>
        ))}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "var(--ink-dim)",
          }}
        >
          Min ★:
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => setMinStar(s)}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "1px solid",
                borderColor: minStar === s ? "var(--ws-gold)" : "var(--border)",
                background:
                  minStar === s ? "rgba(255,215,0,0.15)" : "transparent",
                color: minStar <= s ? "var(--ws-gold)" : "var(--ink-dim)",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              {s}★
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: 6,
            background: msg.ok ? "rgba(46,204,113,0.1)" : "rgba(255,82,82,0.1)",
            border: `1px solid ${msg.ok ? "#2ecc71" : "#ff5252"}`,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          {msg.text}
        </div>
      )}

      {loading ? (
        <Centered>Loading market...</Centered>
      ) : listings.length === 0 ? (
        <div
          className="panel"
          style={{ padding: 32, textAlign: "center", color: "var(--ink-dim)" }}
        >
          No players currently listed. Check back later or adjust filters.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {listings.map((listing) => (
            <MarketCard
              key={listing.id}
              listing={listing}
              buying={buying === listing.id}
              onBuy={() => handleBuy(listing.id)}
              canAfford={budget >= listing.price}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MarketCard({
  listing,
  buying,
  onBuy,
  canAfford,
}: {
  listing: Listing;
  buying: boolean;
  onBuy: () => void;
  canAfford: boolean;
}) {
  const p = listing.player;
  const stars = "★".repeat(p.starRating) + "☆".repeat(5 - p.starRating);
  const stats = [
    { label: "PAC", val: p.pace },
    { label: "SHO", val: p.shooting },
    { label: "PAS", val: p.passing },
    { label: "DEF", val: p.defending },
  ];

  return (
    <div
      className="panel"
      style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {/* Avatar */}
      <div
        style={{
          background: "var(--panel-bg)",
          padding: "16px 16px 0",
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{ width: 72, flexShrink: 0 }}
          dangerouslySetInnerHTML={{ __html: p.avatarSvg ?? "" }}
        />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "var(--display)",
              textTransform: "uppercase",
            }}
          >
            {p.name}
          </div>
          <div
            style={{ fontSize: 11, color: "var(--ink-dim)", marginBottom: 4 }}
          >
            {p.nationality} · {p.age} yrs
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 10,
                padding: "2px 7px",
                borderRadius: 3,
                background: posBg(p.position),
                color: "#0a0d12",
                fontWeight: 700,
              }}
            >
              {p.position}
            </span>
            <span style={{ fontSize: 11, color: "var(--ws-gold)" }}>
              {stars}
            </span>
          </div>
        </div>
      </div>
      {/* Stats */}
      <div style={{ display: "flex", gap: 0, padding: "10px 16px" }}>
        {stats.map((s) => (
          <div key={s.label} style={{ flex: 1, textAlign: "center" }}>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 15,
                fontWeight: 700,
                color: statColor(s.val),
              }}
            >
              {s.val}
            </div>
            <div
              style={{
                fontSize: 9,
                color: "var(--ink-dim)",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
      {/* From team */}
      <div
        style={{
          padding: "0 16px 8px",
          fontSize: 11,
          color: "var(--ink-dim)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <div
          style={{ width: 18, height: 18 }}
          dangerouslySetInnerHTML={{ __html: listing.fromTeam.logoSvg ?? "" }}
        />
        {listing.fromTeam.name}
      </div>
      {/* Price + buy */}
      <div
        style={{
          padding: "10px 16px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--ws-gold)",
            }}
          >
            £{listing.price.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: "var(--ink-dim)" }}>
            Market Val: £{p.marketValue.toLocaleString()}
          </div>
        </div>
        <button
          onClick={onBuy}
          disabled={buying || !canAfford}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: canAfford ? "var(--ws-gold)" : "var(--border)",
            color: canAfford ? "#0a0d12" : "var(--ink-dim)",
            fontWeight: 700,
            fontFamily: "var(--display)",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 1,
            cursor: canAfford ? "pointer" : "not-allowed",
          }}
        >
          {buying ? "..." : canAfford ? "Sign" : "No Budget"}
        </button>
      </div>
    </div>
  );
}

function posBg(pos: string): string {
  return (
    { GK: "#ffd700", DF: "#4fc3f7", MF: "#ce93d8", FW: "#ff5252" }[pos] ??
    "#888"
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
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 64,
        color: "var(--ink)",
      }}
    >
      {children}
    </div>
  );
}
