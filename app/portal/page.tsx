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

const TYPE_CONFIG: Record<
  string,
  { icon: string; color: string; label: string }
> = {
  NEWS: { icon: "📰", color: "var(--away-color)", label: "News" },
  TRANSFER: { icon: "💼", color: "var(--ws-gold)", label: "Transfer" },
  LEAGUE: { icon: "🏆", color: "var(--ws-green-bright)", label: "League" },
  GACHA: { icon: "🎰", color: "#ce93d8", label: "Gacha" },
  SYSTEM: { icon: "⚙️", color: "var(--ink-dim)", label: "System" },
};

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

  async function loadMessages() {
    setLoading(true);
    const res = await fetch("/api/portal");
    const data = await res.json();
    setMessages(data.messages ?? []);
    setUnread(data.messages?.filter((m: Message) => !m.isRead).length ?? 0);
    setLoading(false);
  }

  async function markRead(id?: string) {
    const url = id ? `/api/portal?id=${id}` : "/api/portal";
    await fetch(url, { method: "PATCH" });
    setMessages((prev) =>
      id
        ? prev.map((m) => (m.id === id ? { ...m, isRead: true } : m))
        : prev.map((m) => ({ ...m, isRead: true })),
    );
    setUnread(0);
  }

  async function openMessage(msg: Message) {
    setSelected(msg);
    if (!msg.isRead) markRead(msg.id);
  }

  const types = ["ALL", ...Object.keys(TYPE_CONFIG)];
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
          Your management hub — transfer alerts, league news, and AI-generated
          football coverage.
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

      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              style={{
                padding: "5px 14px",
                borderRadius: 20,
                border: "1px solid",
                borderColor: filter === t ? "var(--ws-gold)" : "var(--border)",
                background:
                  filter === t ? "rgba(255,215,0,0.1)" : "transparent",
                color: filter === t ? "var(--ws-gold)" : "var(--ink-dim)",
                cursor: "pointer",
                fontSize: 11,
                fontFamily: "var(--display)",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {t === "ALL"
                ? "All"
                : TYPE_CONFIG[t]?.icon + " " + TYPE_CONFIG[t]?.label}
            </button>
          ))}
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
        className="ws-portal-grid"
        style={{
          display: "grid",
          gridTemplateColumns: selected ? "1fr 400px" : "1fr",
          gap: 14,
        }}
      >
        {/* Message List */}
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
              No messages yet.
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
                        {new Date(msg.createdAt).toLocaleDateString()}
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

        {/* Message Detail */}
        {selected && (
          <>
            {/* Mobile overlay backdrop */}
            <div
              onClick={() => setSelected(null)}
              style={{
                display: "none",
                position: "fixed",
                inset: 0,
                zIndex: 40,
                background: "rgba(0,0,0,0.6)",
              }}
              className="ws-portal-backdrop"
            />
            <div
              className="panel ws-portal-detail"
              style={{
                padding: 20,
                position: "sticky",
                top: 80,
                alignSelf: "flex-start",
                maxHeight: "calc(100vh - 100px)",
                overflowY: "auto",
              }}
            >
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ink-dim)",
                  cursor: "pointer",
                  fontSize: 12,
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                ← Close
              </button>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--ink-dim)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 6,
                }}
              >
                {TYPE_CONFIG[selected.type]?.icon}{" "}
                {TYPE_CONFIG[selected.type]?.label}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--ink-dim)",
                  marginBottom: 12,
                }}
              >
                {new Date(selected.createdAt).toLocaleString()}
              </div>
              <h2
                style={{
                  fontSize: "1.05rem",
                  fontFamily: "var(--display)",
                  marginBottom: 14,
                  lineHeight: 1.3,
                }}
              >
                {selected.title}
              </h2>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.8,
                  color: "var(--ink-dim)",
                  wordBreak: "break-word",
                }}
              >
                {selected.content}
              </p>
            </div>
          </>
        )}
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
