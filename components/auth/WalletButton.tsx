"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { useHoverSound } from "@/lib/sound/useHoverSound";

export default function WalletButton() {
  const { connected, session, walletAddress, login, logout, loading } =
    useAuth();
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const ctaHover = useHoverSound("cta");
  const subtleHover = useHoverSound("subtle");

  const short = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : null;

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
        <span>👻</span>
        {loading ? "..." : "Connect"}
      </button>
    );
  }

  return (
    <>
      {/* Wallet pill button */}
      <div style={{ position: "relative", flexShrink: 0 }}>
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
          {/* Avatar or default icon */}
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

        {/* Dropdown */}
        {open && (
          <>
            <div
              onClick={() => setOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 90 }}
            />
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 240,
                zIndex: 100,
                background: "var(--panel-bg-2)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                overflow: "hidden",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}
            >
              {/* Club info header */}
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
                </div>

                <div
                  style={{
                    marginTop: 10,
                    padding: "6px 10px",
                    background: "rgba(255,215,0,0.06)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                >
                  Budget:{" "}
                  <span
                    style={{
                      color: "var(--ws-gold)",
                      fontFamily: "var(--mono)",
                    }}
                  >
                    £{(session?.team.budget ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Menu items */}
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
          </>
        )}
      </div>

      {/* Profile Edit Modal */}
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

function ProfileEditModal({ onClose }: { onClose: () => void }) {
  const { session, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(session?.displayName ?? "");
  const [teamName, setTeamName] = useState(session?.team.name ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    session?.avatarBase64 ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ctaHover = useHoverSound("cta");
  const subtleHover = useHoverSound("subtle");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      setMsg("File too large. Max 2MB.");
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
      setMsg("✓ Saved!");
      setTimeout(onClose, 900);
    } else setMsg("Failed to save. Try again.");
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(4px)",
        }}
      />
      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 201,
          width: "min(420px, 94vw)",
          background: "var(--panel-bg-2)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--display)",
              fontSize: "1.1rem",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Edit Profile
          </h2>
          <button
            onClick={onClose}
            {...subtleHover}
            style={{
              background: "none",
              border: "none",
              color: "var(--ink-dim)",
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {/* Avatar upload */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: 90,
                height: 90,
                borderRadius: "50%",
                background: session?.team.jerseyColor ?? "var(--ws-gold)",
                border: "2px dashed rgba(255,215,0,0.4)",
                overflow: "hidden",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                position: "relative",
              }}
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                "📷"
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: 0,
                  transition: "opacity 0.15s",
                  fontSize: 14,
                  color: "#fff",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.opacity = "1")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.opacity = "0")
                }
              >
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
            <span style={{ fontSize: 11, color: "var(--ink-dim)" }}>
              Click to upload avatar (max 2MB)
            </span>
          </div>

          {/* Display name */}
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
              placeholder="Your manager name..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                background: "var(--panel-bg)",
                border: "1px solid var(--border)",
                color: "var(--ink)",
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Team name */}
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
              placeholder="Your club name..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                background: "var(--panel-bg)",
                border: "1px solid var(--border)",
                color: "var(--ink)",
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>

          {msg && (
            <div
              style={{
                fontSize: 13,
                color: msg.startsWith("✓")
                  ? "var(--ws-green-bright)"
                  : "#ff5252",
                textAlign: "center",
              }}
            >
              {msg}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            {...ctaHover}
            style={{
              padding: "12px",
              borderRadius: 8,
              border: "none",
              background: saving ? "var(--border)" : "var(--ws-gold)",
              color: saving ? "var(--ink-dim)" : "#0a0d12",
              fontFamily: "var(--display)",
              fontWeight: 700,
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
}
