"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/useAuth";
import LandingPage from "@/components/auth/LandingPage";
import { useHoverSound } from "@/lib/sound/useHoverSound";
import { APP_NAME } from "@/lib/config";

interface Fixture {
  id: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "SCHEDULED" | "SIMULATED";
  homeTeam: { name: string; isUserControlled: boolean };
  awayTeam: { name: string; isUserControlled: boolean };
}

interface TableRow {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export default function HomePage() {
  const { connected, ready } = useAuth();
  const subtleHover = useHoverSound("subtle");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [table, setTable] = useState<TableRow[]>([]);
  const [leagueName, setLeagueName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connected) {
      load();
    } else {
      // Clear league data immediately when disconnected
      // so stale data doesn't show if user reconnects with different wallet
      setFixtures([]);
      setTable([]);
      setLeagueName("");
      setError(null);
      setLoading(false);
    }
  }, [connected]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const leagueRes = await fetch("/api/leagues/default");
      if (!leagueRes.ok) {
        const data = await leagueRes.json();
        throw new Error(data.error ?? "Failed to load league");
      }
      const league = await leagueRes.json();
      setLeagueName(league.name);
      setFixtures(league.fixtures);

      const tableRes = await fetch(`/api/leagues/${league.id}/table`);
      const tableData = await tableRes.json();
      setTable(tableData.table);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // Show landing page if not connected
  if (!ready) return <Centered>Loading...</Centered>;
  if (!connected) return <LandingPage />;

  if (loading) return <Centered>Loading league...</Centered>;
  if (error)
    return (
      <Centered>
        Error: {error}. Run `npm run db:seed` then generate fixtures.
      </Centered>
    );

  const rounds = new Map<number, Fixture[]>();
  for (const fx of fixtures) {
    if (!rounds.has(fx.round)) rounds.set(fx.round, []);
    rounds.get(fx.round)!.push(fx);
  }
  const roundNumbers = Array.from(rounds.keys()).sort((a, b) => a - b);

  const userClubName =
    fixtures.find((f) => f.homeTeam.isUserControlled)?.homeTeam.name ??
    fixtures.find((f) => f.awayTeam.isUserControlled)?.awayTeam.name ??
    "—";

  const topTeamName = table.length > 0 ? table[0].teamName.split(" ")[0] : "—";

  return (
    <div className="page">
      {/* World Stage 2026 hero banner */}
      <div className="ws-hero">
        <div className="ws-badge">
          <span className="pulse-ball" />
          World Stage 2026 · Live Season
        </div>
        <h1 className="ws-title">{leagueName || APP_NAME}</h1>
        <p className="ws-subtitle">
          Lead your club to glory this season — every rival is managed by an AI
          agent with its own style and strategy.
        </p>
        <div className="ws-stat-row">
          <div className="ws-stat">
            <span className="ws-stat-value">{topTeamName}</span>
            <span className="ws-stat-label">Table Leader</span>
          </div>
          <div className="ws-stat">
            <span className="ws-stat-value">
              {fixtures.filter((f) => f.status === "SIMULATED").length}/
              {fixtures.length}
            </span>
            <span className="ws-stat-label">Matches Played</span>
          </div>
          <div className="ws-stat">
            <span className="ws-stat-value">{roundNumbers.length}</span>
            <span className="ws-stat-label">Total Matchdays</span>
          </div>
          <div className="ws-stat">
            <span className="ws-stat-value">★ {userClubName}</span>
            <span className="ws-stat-label">Your Club</span>
          </div>
        </div>
      </div>

      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 28,
          paddingBottom: 20,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <div className="eyebrow">Season 1 · Matchday Tracker</div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--ink-dim)",
          }}
        >
          <span
            className="dot"
            style={{
              background: "var(--accent)",
              boxShadow: "0 0 8px var(--accent)",
            }}
          />
          <span>★ marks your club</span>
        </div>
      </header>

      <div className="ws-content-grid">
        <section>
          <div className="section-title">Fixtures</div>
          {roundNumbers.length === 0 && (
            <div
              className="panel"
              style={{
                padding: 24,
                textAlign: "center",
                color: "var(--ink-dim)",
              }}
            >
              No fixtures yet. Generate the season schedule via the API (see
              README).
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {roundNumbers.map((round) => (
              <div key={round}>
                <div
                  style={{
                    fontFamily: "var(--display)",
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    color: "var(--ink-dim)",
                    marginBottom: 8,
                  }}
                >
                  Matchday {round}
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {rounds.get(round)!.map((fx) => (
                    <FixtureRow key={fx.id} fixture={fx} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="section-title">League Table</div>
          <div className="panel ws-table-scroll" style={{ overflowX: "auto" }}>
            <table
              style={{
                fontSize: 12.5,
                minWidth: 380,
                whiteSpace: "nowrap",
                width: "100%",
              }}
            >
              <thead>
                <tr style={{ background: "var(--panel-bg)" }}>
                  <th style={thStyle("left", true)}>#</th>
                  <th style={{ ...thStyle("left"), minWidth: 100 }}>Team</th>
                  <th style={thStyle()}>P</th>
                  <th style={thStyle()}>W</th>
                  <th style={thStyle()}>D</th>
                  <th style={thStyle()}>L</th>
                  <th style={thStyle()}>GD</th>
                  <th style={thStyle(undefined, true)}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row, i) => (
                  <tr
                    key={row.teamId}
                    className={i === 0 ? "ws-leader-row" : undefined}
                    style={{
                      borderTop: "1px solid var(--border)",
                      background: i === 0 ? undefined : "transparent",
                    }}
                  >
                    <td style={tdStyle("left")}>
                      <span
                        style={{
                          color: "var(--ink-dim)",
                          fontFamily: "var(--mono)",
                        }}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td
                      style={{
                        ...tdStyle("left"),
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 130,
                      }}
                    >
                      {row.teamName}
                    </td>
                    <td style={tdStyle()}>{row.played}</td>
                    <td style={tdStyle()}>{row.won}</td>
                    <td style={tdStyle()}>{row.drawn}</td>
                    <td style={tdStyle()}>{row.lost}</td>
                    <td style={tdStyle()}>
                      {row.goalsFor - row.goalsAgainst > 0 ? "+" : ""}
                      {row.goalsFor - row.goalsAgainst}
                    </td>
                    <td
                      style={{
                        ...tdStyle(),
                        fontWeight: 700,
                        color: "var(--accent)",
                      }}
                    >
                      {row.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function FixtureRow({ fixture: fx }: { fixture: Fixture }) {
  const played = fx.status === "SIMULATED";
  const subtleHover = useHoverSound("subtle");
  return (
    <Link
      href={`/match/${fx.id}`}
      className="panel ws-fixture-row"
      {...subtleHover}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 64px 1fr 90px",
        alignItems: "center",
        padding: "12px 16px",
        textDecoration: "none",
        color: "var(--ink)",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          textAlign: "right",
        }}
      >
        {fx.homeTeam.isUserControlled && <Star />}
        {fx.homeTeam.name}
        <span className="dot home" />
      </span>

      <span
        style={{
          textAlign: "center",
          fontFamily: "var(--mono)",
          fontSize: played ? "1.05rem" : "0.85rem",
          fontWeight: played ? 700 : 400,
          color: played ? "var(--ink)" : "var(--ink-dim)",
        }}
      >
        {played ? `${fx.homeScore} – ${fx.awayScore}` : "vs"}
      </span>

      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="dot away" />
        {fx.awayTeam.name}
        {fx.awayTeam.isUserControlled && <Star />}
      </span>

      <span
        style={{
          textAlign: "right",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: played ? "var(--away-color)" : "var(--ink-dim)",
        }}
      >
        {played ? "Played" : "Upcoming"}
      </span>
    </Link>
  );
}

function Star() {
  return <span style={{ color: "var(--accent)", fontSize: 12 }}>★</span>;
}

function thStyle(
  align: "left" | "center" = "center",
  emphasis = false,
): React.CSSProperties {
  return {
    textAlign: align,
    padding: "10px 8px",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: emphasis ? "var(--accent)" : "var(--ink-dim)",
    fontWeight: 600,
  };
}

function tdStyle(align: "left" | "center" = "center"): React.CSSProperties {
  return {
    textAlign: align,
    padding: "10px 8px",
  };
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        color: "var(--ink)",
      }}
    >
      {children}
    </div>
  );
}
