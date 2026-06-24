"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth/useAuth";
import { useHoverSound } from "@/lib/sound/useHoverSound";

export default function WalletButton() {
  const { connected, session, walletAddress, login, logout, loading } =
    useAuth();
  // const { linkWallet } = usePrivy(); // for linking external wallet to email account
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [copied, setCopied] = useState(false);
  const ctaHover = useHoverSound("cta");
  const subtleHover = useHoverSound("subtle");
  const containerRef = useRef<HTMLDivElement>(null);

  const short = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : null;

  // Click-outside to close dropdown — listens globally, more robust than a
  // single full-screen backdrop div (works even with nested portals/z-index issues)
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function copyAddress() {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback for browsers without clipboard API permission
      const textarea = document.createElement("textarea");
      textarea.value = walletAddress;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  if (!connected) {
    return (
      <button
        onClick={login}
        disabled={loading}
        {...ctaHover}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 18px",
          borderRadius: 8,
          border: "none",
          background: "var(--ws-gold)",
          color: "#0a0d12",
          fontFamily: "var(--display)",
          fontWeight: 700,
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: 1.5,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
          flexShrink: 0,
        }}
      >
        <span>🏆</span>
        {loading ? "..." : "Connect"}
      </button>
    );
  }

  return (
    <>
      <div ref={containerRef} style={{ position: "relative", flexShrink: 0 }}>
        <button
          onClick={() => setOpen((o) => !o)}
          {...subtleHover}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "7px 14px",
            borderRadius: 8,
            background: open ? "rgba(255,215,0,0.12)" : "var(--panel-bg-2)",
            border: `1px solid ${open ? "rgba(255,215,0,0.5)" : "var(--border)"}`,
            color: "var(--ink)",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: session?.team.jerseyColor ?? "var(--ws-gold)",
              overflow: "hidden",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            {session?.avatarBase64 ? (
              <img
                src={session.avatarBase64}
                alt="avatar"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              "👤"
            )}
          </div>

          <div style={{ textAlign: "left", lineHeight: 1.2 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>
              {session?.displayName ?? session?.team.name ?? short}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--ink-dim)",
                fontFamily: "var(--mono)",
              }}
            >
              {short}
            </div>
          </div>

          <span
            style={{ color: "var(--ink-dim)", fontSize: 10, marginLeft: 2 }}
          >
            {open ? "▲" : "▼"}
          </span>
        </button>

        {open && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width: 250,
              zIndex: 100,
              background: "var(--panel-bg-2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--border)",
                background: "var(--panel-bg)",
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: session?.team.jerseyColor ?? "var(--ws-gold)",
                    overflow: "hidden",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                  }}
                >
                  {session?.avatarBase64 ? (
                    <img
                      src={session.avatarBase64}
                      alt="avatar"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    "👤"
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {session?.displayName ?? "Manager"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ws-gold)" }}>
                    {session?.team.name}
                  </div>
                </div>
              </div>

              {/* Wallet address + copy button */}
              <button
                onClick={copyAddress}
                {...subtleHover}
                style={{
                  marginTop: 10,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: "var(--panel-bg)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    fontFamily: "var(--mono)",
                  }}
                >
                  {short}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: copied ? "var(--ws-green-bright)" : "var(--ink-dim)",
                  }}
                >
                  {copied ? "✓ Copied" : "📋 Copy"}
                </span>
              </button>

              <div
                style={{
                  marginTop: 8,
                  padding: "6px 10px",
                  background: "rgba(255,215,0,0.06)",
                  borderRadius: 6,
                  fontSize: 12,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ color: "var(--ink-dim)" }}>Budget</span>
                <span
                  style={{ color: "var(--ws-gold)", fontFamily: "var(--mono)" }}
                >
                  £{(session?.team.budget ?? 0).toLocaleString()}
                </span>
              </div>
              <div
                style={{
                  marginTop: 4,
                  padding: "6px 10px",
                  background: "rgba(46,204,113,0.06)",
                  borderRadius: 6,
                  fontSize: 12,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ color: "var(--ink-dim)" }}>USD Balance</span>
                <span
                  style={{
                    color: "var(--ws-green-bright)",
                    fontFamily: "var(--mono)",
                  }}
                >
                  ${((session?.usdBalance ?? 0) / 100).toLocaleString()}
                </span>
              </div>
            </div>

            <div style={{ padding: "6px 0" }}>
              <DropdownItem
                icon="✏️"
                label="Edit Profile"
                onClick={() => {
                  setShowProfile(true);
                  setOpen(false);
                }}
                hover={subtleHover}
              />
              <DropdownItem
                icon="🔗"
                label="View on Solscan"
                onClick={() =>
                  window.open(
                    `https://solscan.io/account/${walletAddress}?cluster=devnet`,
                    "_blank",
                  )
                }
                hover={subtleHover}
              />
              <div
                style={{
                  height: 1,
                  background: "var(--border)",
                  margin: "6px 0",
                }}
              />
              <DropdownItem
                icon="🔌"
                label="Disconnect Wallet"
                onClick={() => {
                  logout();
                  setOpen(false);
                }}
                hover={subtleHover}
                danger
              />
            </div>
          </div>
        )}
      </div>

      {showProfile && (
        <ProfileEditModal onClose={() => setShowProfile(false)} />
      )}
    </>
  );
}

function DropdownItem({
  icon,
  label,
  onClick,
  hover,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  hover: ReturnType<typeof useHoverSound>;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      {...hover}
      style={{
        width: "100%",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "transparent",
        border: "none",
        color: danger ? "#ff5252" : "var(--ink)",
        fontSize: 13,
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = danger
          ? "rgba(255,82,82,0.08)"
          : "rgba(255,255,255,0.04)";
        hover.onMouseEnter();
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ─── Profile Edit Modal — full-screen dApp-style overlay ─────────────────────

function ProfileEditModal({ onClose }: { onClose: () => void }) {
  const { session, walletAddress, updateProfile, refetch } = useAuth();
  const [displayName, setDisplayName] = useState(session?.displayName ?? "");
  const [teamName, setTeamName] = useState(session?.team.name ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    session?.avatarBase64 ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const ctaHover = useHoverSound("cta");
  const subtleHover = useHoverSound("subtle");

  // Portal target only exists client-side — guards against SSR mismatch
  // (document.body isn't available during server rendering).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Click-outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      setMsg({ text: "File too large. Max 2MB.", ok: false });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    const ok = await updateProfile({
      displayName: displayName.trim() || undefined,
      teamName: teamName.trim() || undefined,
      avatarBase64: avatarPreview ?? undefined,
    });
    setSaving(false);
    if (ok) {
      setMsg({ text: "Profile updated successfully!", ok: true });
      await refetch(); // auto-refetch session, no manual page reload needed
      setTimeout(onClose, 1100);
    } else {
      setMsg({ text: "Failed to save. Please try again.", ok: false });
    }
  }

  const shortWallet = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}`
    : "";

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(5,7,10,0.85)",
          backdropFilter: "blur(8px)",
        }}
      />

      {/* Overlay container — medium modal, centered */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 201,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "5vh 20px",
          overflowY: "auto",
        }}
      >
        <div
          ref={modalRef}
          style={{
            width: "min(560px, 100%)",
            maxHeight: "90vh",
            overflowY: "auto",
            borderRadius: 16,
            background: "linear-gradient(160deg, #0d1117 0%, #0a0d12 100%)",
            border: "1px solid rgba(255,215,0,0.2)",
            boxShadow:
              "0 0 60px rgba(255,215,0,0.08), 0 24px 64px rgba(0,0,0,0.7)",
            // Note: no overflow:hidden here — it would cancel overflowY:auto
            // above and clip content taller than maxHeight instead of scrolling.
          }}
          className="scroll-thin"
        >
          {/* Header band */}
          <div
            style={{
              padding: "20px 24px",
              background:
                "linear-gradient(135deg, rgba(255,215,0,0.06), transparent)",
              borderBottom: "1px solid var(--border)",
              borderRadius: "16px 16px 0 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div className="ws-badge" style={{ marginBottom: 6 }}>
                <span className="pulse-ball" />
                Manager Profile
              </div>
              <h2
                style={{
                  fontFamily: "var(--display)",
                  fontSize: "1.25rem",
                  textTransform: "uppercase",
                  margin: 0,
                  letterSpacing: 1,
                }}
              >
                Edit Your Identity
              </h2>
            </div>
            <button
              onClick={onClose}
              {...subtleHover}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--panel-bg)",
                border: "1px solid var(--border)",
                color: "var(--ink-dim)",
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>

          <div
            style={{
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 18,
              borderRadius: "0 0 16px 16px",
            }}
          >
            {/* Avatar — centered at top */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  width: 110,
                  height: 110,
                  borderRadius: "50%",
                  background: session?.team.jerseyColor ?? "var(--ws-gold)",
                  border: "3px dashed rgba(255,215,0,0.4)",
                  overflow: "hidden",
                  cursor: "pointer",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 38,
                  flexShrink: 0,
                  boxShadow: "0 0 30px rgba(255,215,0,0.15)",
                }}
              >
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="preview"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  "📷"
                )}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: 0,
                    transition: "opacity 0.15s",
                    fontSize: 11,
                    color: "#fff",
                    flexDirection: "column",
                    gap: 3,
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.opacity = "1")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.opacity = "0")
                  }
                >
                  <span style={{ fontSize: 18 }}>📤</span>
                  Change
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <span style={{ fontSize: 10, color: "var(--ink-dim)" }}>
                Max 2MB · JPG, PNG, GIF
              </span>
            </div>

            {/* Wallet info card */}
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(153,69,255,0.06)",
                border: "1px solid rgba(153,69,255,0.25)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 16 }}>👛</span>
              <div>
                <div
                  style={{
                    fontSize: 9,
                    color: "var(--ink-dim)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Connected Wallet
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: "var(--mono)",
                    color: "#9945FF",
                  }}
                >
                  {shortWallet}
                </div>
              </div>
            </div>

            <div>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--ink-dim)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Manager Name
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={30}
                placeholder={session?.displayName ?? "Your manager name..."}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 8,
                  background: "var(--panel-bg)",
                  border: "1px solid var(--border)",
                  color: "var(--ink)",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--ink-dim)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Club Name
              </label>
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                maxLength={40}
                placeholder={session?.team.name ?? "Your club name..."}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 8,
                  background: "var(--panel-bg)",
                  border: "1px solid var(--border)",
                  color: "var(--ink)",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Manager stats — compact row */}
            {session && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                  padding: 12,
                  borderRadius: 10,
                  background: "var(--panel-bg)",
                  border: "1px solid var(--border)",
                }}
              >
                <StatBlock
                  label="Level"
                  value={String(session.managerLevel ?? 1)}
                />
                <StatBlock
                  label="Wins"
                  value={String(session.totalWins ?? 0)}
                />
                <StatBlock
                  label="Matches"
                  value={String(session.totalMatches ?? 0)}
                />
              </div>
            )}

            {msg && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  background: msg.ok
                    ? "rgba(46,204,113,0.1)"
                    : "rgba(255,82,82,0.1)",
                  border: `1px solid ${msg.ok ? "rgba(46,204,113,0.3)" : "rgba(255,82,82,0.3)"}`,
                  color: msg.ok ? "var(--ws-green-bright)" : "#ff5252",
                }}
              >
                {msg.ok ? "✓ " : "⚠ "}
                {msg.text}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onClose}
                {...subtleHover}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--ink-dim)",
                  fontFamily: "var(--display)",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                {...ctaHover}
                style={{
                  flex: 2,
                  padding: "12px",
                  borderRadius: 8,
                  border: "none",
                  background: saving ? "var(--border)" : "var(--ws-gold)",
                  color: saving ? "var(--ink-dim)" : "#0a0d12",
                  fontFamily: "var(--display)",
                  fontWeight: 700,
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving..." : "💾 Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // Render via portal directly to document.body. This is the key fix: if
  // ProfileEditModal were rendered inline inside the component tree, any
  // ancestor with `backdrop-filter` or `filter` (e.g. the `.panel` class
  // used throughout Squad/Market/etc, which has `backdrop-filter: blur(6px)`)
  // creates a new CSS containing block. That silently breaks `position: fixed`
  // for all descendants — instead of covering the full viewport, the backdrop
  // and modal get clipped to that ancestor's box, which is exactly the
  // "modal looks cut off / transparent" bug seen on the Squad page. Portaling
  // to document.body guarantees the modal is always a direct child of <body>,
  // outside any such filtered ancestor, so position:fixed behaves correctly
  // no matter which page WalletButton is mounted in.
  if (!mounted) return null;

  return createPortal(modalContent, document.body);
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: "1.2rem",
          fontWeight: 700,
          color: "var(--ws-gold)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 9,
          color: "var(--ink-dim)",
          textTransform: "uppercase",
          letterSpacing: 1,
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}
