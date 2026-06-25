"use client";

import { useEffect, useState } from "react";
import AuthWall from "@/components/auth/AuthWall";

interface Message {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  metadata?: any;
}

// All possible types including TRAINING/EXP/FRIENDLY that were missing before
const TYPE_CONFIG: Record<
  string,
  { icon: string; color: string; label: string }
> = {
  NEWS: { icon: "📰", color: "var(--away-color)", label: "News" },
  TRANSFER: { icon: "💼", color: "var(--ws-gold)", label: "Transfer" },
  LEAGUE: { icon: "🏆", color: "var(--ws-green-bright)", label: "League" },
  GACHA: { icon: "🎰", color: "#ce93d8", label: "Gacha" },
  SYSTEM: { icon: "⚙️", color: "var(--ink-dim)", label: "System" },
  TRAINING: { icon: "💪", color: "#4fc3f7", label: "Training" },
  EXP: { icon: "⭐", color: "#ffd700", label: "EXP" },
  FRIENDLY: { icon: "🤝", color: "#81c784", label: "Friendly" },
};

// Format: MM/dd/yyyy
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${fmtDate(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function PortalPage() {
  return (
    <AuthWall>
      <PortalContent />
    </AuthWall>
  );
}

function PortalContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState<Message | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    loadMessages();
  }, []);

  // Clear selected when changing filter — poin 3
  useEffect(() => {
    setSelected(null);
  }, [filter]);

  async function loadMessages() {
    setLoading(true);
    const res = await fetch("/api/portal");
    const data = await res.json();
    setMessages(data.messages ?? []);
    setUnread(data.messages?.filter((m: Message) => !m.isRead).length ?? 0);
    setLoading(false);
  }

  async function markRead(id?: string) {
    await fetch(id ? `/api/portal?id=${id}` : "/api/portal", {
      method: "PATCH",
    });
    setMessages((prev) =>
      id
        ? prev.map((m) => (m.id === id ? { ...m, isRead: true } : m))
        : prev.map((m) => ({ ...m, isRead: true })),
    );
    if (!id) setUnread(0);
  }

  async function openMessage(msg: Message) {
    setSelected(msg);
    if (!msg.isRead) markRead(msg.id);
  }

  // Build filter tabs from actual types present in messages + always show ALL
  // Fix poin 1: use actual message types from DB, not just TYPE_CONFIG keys
  const presentTypes = Array.from(new Set(messages.map((m) => m.type)));
  const tabs = ["ALL", ...presentTypes.filter((t) => TYPE_CONFIG[t])];

  const filtered =
    filter === "ALL" ? messages : messages.filter((m) => m.type === filter);

  return (
    <div className="page">
      <div className="ws-hero" style={{ marginBottom: 20 }}>
        <div className="ws-badge">
          <span className="pulse-ball" />
          Inbox
        </div>
        <h1 className="ws-title">Portal</h1>
        <p className="ws-subtitle">
          Transfer alerts, league news, and management updates.
          {unread > 0 && (
            <span
              style={{
                marginLeft: 10,
                color: "var(--ws-gold)",
                fontWeight: 700,
              }}
            >
              {unread} unread
            </span>
          )}
        </p>
      </div>

      {/* Filter tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {tabs.map((t) => {
            const cfg = TYPE_CONFIG[t];
            const count =
              t === "ALL"
                ? messages.length
                : messages.filter((m) => m.type === t).length;
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  border: "1px solid",
                  borderColor:
                    filter === t ? "var(--ws-gold)" : "var(--border)",
                  background:
                    filter === t ? "rgba(255,215,0,0.1)" : "transparent",
                  color: filter === t ? "var(--ws-gold)" : "var(--ink-dim)",
                  cursor: "pointer",
                  fontSize: 11,
                  fontFamily: "var(--display)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {t === "ALL" ? "All" : `${cfg.icon} ${cfg.label}`}
                <span style={{ fontSize: 9, opacity: 0.6 }}>({count})</span>
              </button>
            );
          })}
        </div>
        {unread > 0 && (
          <button
            onClick={() => markRead()}
            style={{
              fontSize: 11,
              color: "var(--ink-dim)",
              background: "none",
              border: "1px solid var(--border)",
              padding: "5px 12px",
              borderRadius: 20,
              cursor: "pointer",
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: selected
            ? "minmax(0,1fr) min(380px, 40vw)"
            : "1fr",
          gap: 14,
          alignItems: "flex-start",
        }}
      >
        {/* Message list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {loading ? (
            <Centered>Loading messages...</Centered>
          ) : filtered.length === 0 ? (
            <div
              className="panel"
              style={{
                padding: 32,
                textAlign: "center",
                color: "var(--ink-dim)",
              }}
            >
              No messages in this category.
            </div>
          ) : (
            filtered.map((msg) => {
              const cfg = TYPE_CONFIG[msg.type] ?? TYPE_CONFIG.SYSTEM;
              return (
                <div
                  key={msg.id}
                  onClick={() => openMessage(msg)}
                  className="panel ws-fixture-row"
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    background:
                      selected?.id === msg.id
                        ? "rgba(255,215,0,0.05)"
                        : !msg.isRead
                          ? "rgba(255,255,255,0.03)"
                          : "rgba(26,32,41,0.82)",
                    borderLeft: !msg.isRead
                      ? `3px solid ${cfg.color}`
                      : "3px solid transparent",
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>
                    {cfg.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: msg.isRead ? 400 : 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {msg.title}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--ink-dim)",
                          flexShrink: 0,
                        }}
                      >
                        {fmtDate(msg.createdAt)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--ink-dim)",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {msg.content}
                    </div>
                    <span
                      style={{
                        fontSize: 9,
                        padding: "2px 7px",
                        borderRadius: 10,
                        background: `${cfg.color}22`,
                        color: cfg.color,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        fontFamily: "var(--mono)",
                        marginTop: 4,
                        display: "inline-block",
                      }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  {!msg.isRead && (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: cfg.color,
                        flexShrink: 0,
                        marginTop: 4,
                      }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Detail panel — poin 3: constrained, no overflow */}
        {selected &&
          (() => {
            const cfg = TYPE_CONFIG[selected.type] ?? TYPE_CONFIG.SYSTEM;
            return (
              <div
                className="panel"
                style={{
                  padding: 20,
                  position: "sticky",
                  top: 80,
                  maxHeight: "calc(100vh - 120px)",
                  overflowY: "auto",
                  overflowX: "hidden",
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                  minWidth: 0,
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      color: cfg.color,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    {cfg.icon} {cfg.label}
                  </span>
                  <button
                    onClick={() => setSelected(null)}
                    style={{
                      background: "none",
                      border: "1px solid var(--border)",
                      color: "var(--ink-dim)",
                      cursor: "pointer",
                      fontSize: 11,
                      padding: "3px 10px",
                      borderRadius: 6,
                    }}
                  >
                    ✕ Close
                  </button>
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--ink-dim)",
                    marginBottom: 12,
                  }}
                >
                  {fmtDateTime(selected.createdAt)}
                </div>
                <h2
                  style={{
                    fontSize: "1rem",
                    fontFamily: "var(--display)",
                    marginBottom: 14,
                    lineHeight: 1.4,
                  }}
                >
                  {selected.title}
                </h2>
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: 1.9,
                    color: "var(--ink-dim)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {selected.content}
                </p>
              </div>
            );
          })()}
      </div>
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
        padding: 64,
        color: "var(--ink)",
      }}
    >
      {children}
    </div>
  );
}
