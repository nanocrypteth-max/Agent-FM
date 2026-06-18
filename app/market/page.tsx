"use client";

import { useEffect, useState, useCallback } from "react";
import AuthWall from "@/components/auth/AuthWall";
import { useAuth } from "@/lib/auth/useAuth";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  price: number;
  priceSOL: number;
  isSOLListing: boolean;
  status: string;
  listedAt: string;
  soldAt: string | null;
  sellerWallet: string | null;
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
  fromTeam: {
    id: string;
    name: string;
    logoSvg: string | null;
    jerseyColor: string;
  };
}

interface MyPlayer {
  id: string;
  name: string;
  position: string;
  starRating: number;
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  stamina: number;
  avatarSvg: string | null;
  marketValue: number;
  teamId: string;
}

const POSITIONS = ["ALL", "GK", "DF", "MF", "FW"];
const RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const TREASURY = process.env.NEXT_PUBLIC_SOLANA_TREASURY ?? "";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketPage() {
  return (
    <AuthWall>
      <MarketContent />
    </AuthWall>
  );
}

function MarketContent() {
  const { walletAddress, session } = useAuth();
  const [tab, setTab] = useState<"browse" | "my-listings">("browse");

  return (
    <div className="page">
      <div className="ws-hero" style={{ marginBottom: 20 }}>
        <div className="ws-badge">
          <span className="pulse-ball" />
          Transfer Market · SOL
        </div>
        <h1 className="ws-title">Player Market</h1>
        <p className="ws-subtitle">
          Buy and sell players using Solana. Set your own price.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 0,
        }}
      >
        {(["browse", "my-listings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 20px",
              border: "none",
              cursor: "pointer",
              background: "transparent",
              fontSize: 13,
              fontFamily: "var(--display)",
              textTransform: "uppercase",
              letterSpacing: 1,
              color: tab === t ? "var(--ws-gold)" : "var(--ink-dim)",
              borderBottom:
                tab === t
                  ? "2px solid var(--ws-gold)"
                  : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t === "browse" ? "🛒 Browse Market" : "📋 My Listings"}
          </button>
        ))}
      </div>

      {tab === "browse" ? (
        <BrowseTab walletAddress={walletAddress} session={session} />
      ) : (
        <MyListingsTab walletAddress={walletAddress} session={session} />
      )}
    </div>
  );
}

// ─── Browse Tab ───────────────────────────────────────────────────────────────

function BrowseTab({
  walletAddress,
  session,
}: {
  walletAddress: string | null;
  session: any;
}) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState("ALL");
  const [minStar, setMinStar] = useState(1);
  const [buying, setBuying] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const loadListings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (position !== "ALL") params.set("position", position);
    params.set("minStar", String(minStar));
    const res = await fetch(`/api/market?${params}`);
    const data = await res.json();
    setListings(data.listings ?? []);
    setLoading(false);
  }, [position, minStar]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  async function handleBuySOL(listing: Listing) {
    if (!walletAddress) {
      setMsg({ text: "Wallet not connected", ok: false });
      return;
    }
    if (!listing.sellerWallet) {
      setMsg({ text: "Seller wallet not available", ok: false });
      return;
    }
    setBuying(listing.id);
    setMsg(null);

    try {
      // Get Privy's Solana wallet for signing
      const phantom = (window as any).phantom?.solana ?? (window as any).solana;
      const signerWallet = phantom?.isPhantom ? phantom : null;
      if (!signerWallet)
        throw new Error("No wallet found. Please connect via Privy.");

      const connection = new Connection(RPC, "confirmed");
      const lamports = Math.round(listing.priceSOL * LAMPORTS_PER_SOL);

      // Send SOL directly to SELLER wallet (not treasury)
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(walletAddress),
          toPubkey: new PublicKey(listing.sellerWallet), // ← direct to seller
          lamports,
        }),
      );
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(walletAddress);

      const { signature } = await signerWallet.signAndSendTransaction(tx);

      const res = await fetch("/api/market/buy-sol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerWallet: walletAddress,
          listingId: listing.id,
          txHash: signature,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setMsg({
          text: `✅ ${data.player} signed for ${data.priceSOL} SOL!`,
          ok: true,
        });
        setListings((prev) => prev.filter((l) => l.id !== listing.id));
      } else {
        setMsg({ text: data.error, ok: false });
      }
    } catch (e: any) {
      setMsg({ text: e?.message ?? "Transaction failed", ok: false });
    }
    setBuying(null);
  }

  // Filter out own listings
  const filteredListings = listings.filter(
    (l) => l.sellerWallet !== walletAddress,
  );

  return (
    <>
      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 10,
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
            gap: 6,
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
                color: "var(--ws-gold)",
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
            marginBottom: 16,
            fontSize: 13,
            background: msg.ok ? "rgba(46,204,113,0.1)" : "rgba(255,82,82,0.1)",
            border: `1px solid ${msg.ok ? "#2ecc71" : "#ff5252"}`,
            color: msg.ok ? "#2ecc71" : "#ff5252",
          }}
        >
          {msg.text}
        </div>
      )}

      {loading ? (
        <Centered>Loading market...</Centered>
      ) : filteredListings.length === 0 ? (
        <div
          className="panel"
          style={{ padding: 32, textAlign: "center", color: "var(--ink-dim)" }}
        >
          No SOL listings available. Check back later or adjust filters.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {filteredListings.map((l) => (
            <MarketCard
              key={l.id}
              listing={l}
              buying={buying === l.id}
              onBuy={() => handleBuySOL(l)}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ─── My Listings Tab ──────────────────────────────────────────────────────────

function MyListingsTab({
  walletAddress,
  session,
}: {
  walletAddress: string | null;
  session: any;
}) {
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [myPlayers, setMyPlayers] = useState<MyPlayer[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  // Sell form state
  const [selectedPlayer, setSelectedPlayer] = useState<MyPlayer | null>(null);
  const [priceSOL, setPriceSOL] = useState("");
  const [listing, setListing] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const loadMyListings = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingListings(true);
    const res = await fetch(
      `/api/market?sellerWallet=${walletAddress}&includeSOLD=true`,
    );
    if (res.ok) {
      const data = await res.json();
      // Show both LISTED and SOLD, filter to only seller's listings
      setMyListings(
        (data.listings ?? []).filter(
          (l: Listing) => l.sellerWallet === walletAddress,
        ),
      );
    }
    setLoadingListings(false);
  }, [walletAddress]);

  const loadMyPlayers = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingPlayers(true);
    const res = await fetch(`/api/squad?wallet=${walletAddress}`);
    if (res.ok) {
      const data = await res.json();
      setMyPlayers(data.players ?? []);
    }
    setLoadingPlayers(false);
  }, [walletAddress]);

  useEffect(() => {
    loadMyListings();
    loadMyPlayers();
  }, [loadMyListings, loadMyPlayers]);

  async function handleList() {
    if (!selectedPlayer || !walletAddress || !priceSOL) return;
    const sol = parseFloat(priceSOL);
    if (isNaN(sol) || sol <= 0) {
      setMsg({ text: "Enter a valid SOL price", ok: false });
      return;
    }

    setListing(true);
    setMsg(null);
    const res = await fetch("/api/market/sell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        solanaWallet: walletAddress,
        playerId: selectedPlayer.id,
        priceSOL: sol,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg({
        text: `✅ ${selectedPlayer.name} listed for ${sol} SOL!`,
        ok: true,
      });
      setSelectedPlayer(null);
      setPriceSOL("");
      loadMyListings();
      loadMyPlayers();
    } else {
      setMsg({ text: data.error, ok: false });
    }
    setListing(false);
  }

  async function handleCancel(listingId: string, playerName: string) {
    setCancelling(listingId);
    const res = await fetch(`/api/market/list?playerId=${listingId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMsg({ text: `${playerName} delisted successfully`, ok: true });
      setMyListings((prev) => prev.filter((l) => l.id !== listingId));
      loadMyPlayers();
    }
    setCancelling(null);
  }

  // Players not already listed
  const listedPlayerIds = new Set(myListings.map((l) => l.player.id));
  const availablePlayers = myPlayers.filter((p) => !listedPlayerIds.has(p.id));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 360px",
        gap: 20,
        alignItems: "start",
      }}
    >
      {/* Active listings */}
      <div>
        <div className="section-title">Active Listings</div>
        {loadingListings ? (
          <Centered>Loading...</Centered>
        ) : myListings.length === 0 ? (
          <div
            className="panel"
            style={{
              padding: 32,
              textAlign: "center",
              color: "var(--ink-dim)",
              fontSize: 13,
            }}
          >
            You have no active listings. List a player using the form →
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {myListings.map((l) => (
              <div
                key={l.id}
                className="panel"
                style={{
                  padding: "14px 16px",
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  opacity: l.status === "SOLD" ? 0.75 : 1,
                  borderLeft:
                    l.status === "SOLD"
                      ? "3px solid #2ecc71"
                      : "3px solid transparent",
                }}
              >
                {l.player.avatarSvg && (
                  <div
                    style={{ width: 48, flexShrink: 0 }}
                    dangerouslySetInnerHTML={{ __html: l.player.avatarSvg }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--display)",
                      fontSize: "0.95rem",
                      textTransform: "uppercase",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {l.player.name}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 4,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 3,
                        background: posBg(l.player.position),
                        color: "#0a0d12",
                        fontWeight: 700,
                      }}
                    >
                      {l.player.position}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--ws-gold)" }}>
                      {"★".repeat(l.player.starRating)}
                    </span>
                    {l.status === "SOLD" && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 3,
                          background: "rgba(46,204,113,0.15)",
                          color: "#2ecc71",
                          fontWeight: 700,
                          border: "1px solid rgba(46,204,113,0.4)",
                        }}
                      >
                        ✓ SOLD ·{" "}
                        {l.soldAt
                          ? new Date(l.soldAt).toLocaleDateString()
                          : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      color: l.status === "SOLD" ? "#2ecc71" : "#9945FF",
                    }}
                  >
                    ◎ {l.priceSOL} SOL
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--ink-dim)",
                      marginTop: 2,
                    }}
                  >
                    {l.status === "SOLD"
                      ? "Received to wallet"
                      : new Date(l.listedAt).toLocaleDateString()}
                  </div>
                </div>
                {l.status === "LISTED" && (
                  <button
                    onClick={() => handleCancel(l.id, l.player.name)}
                    disabled={cancelling === l.id}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid rgba(255,82,82,0.4)",
                      background: "rgba(255,82,82,0.08)",
                      color: "#ff5252",
                      fontSize: 11,
                      cursor: "pointer",
                      fontFamily: "var(--display)",
                      flexShrink: 0,
                    }}
                  >
                    {cancelling === l.id ? "..." : "Delist"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sell form */}
      <div style={{ position: "sticky", top: 80 }}>
        <div className="section-title">List Player for Sale</div>
        <div
          className="panel"
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {msg && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 6,
                fontSize: 13,
                background: msg.ok
                  ? "rgba(46,204,113,0.1)"
                  : "rgba(255,82,82,0.1)",
                border: `1px solid ${msg.ok ? "#2ecc71" : "#ff5252"}`,
                color: msg.ok ? "#2ecc71" : "#ff5252",
              }}
            >
              {msg.text}
            </div>
          )}

          {/* Player picker */}
          <div>
            <label
              style={{
                fontSize: 11,
                color: "var(--ink-dim)",
                textTransform: "uppercase",
                letterSpacing: 1,
                display: "block",
                marginBottom: 8,
              }}
            >
              Select Player
            </label>
            {loadingPlayers ? (
              <div style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                Loading players...
              </div>
            ) : availablePlayers.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                All players are already listed.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  maxHeight: 280,
                  overflowY: "auto",
                }}
                className="scroll-thin"
              >
                {availablePlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      setSelectedPlayer(selectedPlayer?.id === p.id ? null : p)
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      borderRadius: 6,
                      cursor: "pointer",
                      border: `1px solid ${selectedPlayer?.id === p.id ? "var(--ws-gold)" : "var(--border)"}`,
                      background:
                        selectedPlayer?.id === p.id
                          ? "rgba(255,215,0,0.08)"
                          : "var(--panel-bg)",
                      textAlign: "left",
                    }}
                  >
                    {p.avatarSvg && (
                      <div
                        style={{ width: 36, flexShrink: 0 }}
                        dangerouslySetInnerHTML={{ __html: p.avatarSvg }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: "var(--ink)",
                        }}
                      >
                        {p.name}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--ink-dim)",
                          marginTop: 2,
                        }}
                      >
                        {p.position} · {"★".repeat(p.starRating)} · Market: £
                        {p.marketValue.toLocaleString()}
                      </div>
                    </div>
                    {selectedPlayer?.id === p.id && (
                      <span style={{ color: "var(--ws-gold)", fontSize: 14 }}>
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Price input */}
          {selectedPlayer && (
            <>
              <div>
                <label
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  Price (SOL)
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#9945FF", fontSize: 18 }}>◎</span>
                  <input
                    type="number"
                    value={priceSOL}
                    onChange={(e) => setPriceSOL(e.target.value)}
                    placeholder="0.00"
                    min="0.001"
                    step="0.001"
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--panel-bg)",
                      color: "var(--ink)",
                      fontFamily: "var(--mono)",
                      fontSize: 16,
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                    SOL
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 6,
                  }}
                >
                  Market value: £{selectedPlayer.marketValue.toLocaleString()} ·
                  Suggest: ~
                  {(selectedPlayer.marketValue / 1_000_000).toFixed(3)} SOL
                </div>
              </div>

              <button
                onClick={handleList}
                disabled={listing || !priceSOL || parseFloat(priceSOL) <= 0}
                style={{
                  padding: "12px",
                  borderRadius: 8,
                  border: "none",
                  background:
                    listing || !priceSOL ? "var(--border)" : "#9945FF",
                  color: listing || !priceSOL ? "var(--ink-dim)" : "#fff",
                  fontFamily: "var(--display)",
                  fontWeight: 700,
                  fontSize: 14,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  cursor: listing || !priceSOL ? "not-allowed" : "pointer",
                }}
              >
                {listing
                  ? "Listing..."
                  : `List ${selectedPlayer.name} for ◎ ${priceSOL || "?"} SOL`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Market Card (browse) ─────────────────────────────────────────────────────

function MarketCard({
  listing,
  buying,
  onBuy,
}: {
  listing: Listing;
  buying: boolean;
  onBuy: () => void;
}) {
  const p = listing.player;
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
              {"★".repeat(p.starRating)}
              {"☆".repeat(5 - p.starRating)}
            </span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", padding: "10px 16px" }}>
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
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
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
              fontSize: 15,
              fontWeight: 700,
              color: "#9945FF",
            }}
          >
            ◎ {listing.priceSOL} SOL
          </div>
          <div style={{ fontSize: 10, color: "var(--ink-dim)" }}>
            Market Val: £{p.marketValue.toLocaleString()}
          </div>
        </div>
        <button
          onClick={onBuy}
          disabled={buying}
          style={{
            padding: "8px 18px",
            borderRadius: 6,
            border: "none",
            background: buying ? "var(--border)" : "#9945FF",
            color: buying ? "var(--ink-dim)" : "#fff",
            fontWeight: 700,
            fontFamily: "var(--display)",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 1,
            cursor: buying ? "not-allowed" : "pointer",
          }}
        >
          {buying ? "..." : "Buy"}
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
