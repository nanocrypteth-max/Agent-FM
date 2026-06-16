import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface TeamRow {
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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const league = await prisma.league.findUnique({
    where: { id: params.id },
    include: {
      teams: { select: { id: true, name: true, isUserControlled: true } },
      fixtures: {
        where: { status: "SIMULATED" },
        select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
      },
    },
  });

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const table = new Map<string, TeamRow>();
  for (const team of league.teams) {
    table.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    });
  }

  for (const fx of league.fixtures) {
    if (fx.homeScore === null || fx.awayScore === null) continue;

    const home = table.get(fx.homeTeamId);
    const away = table.get(fx.awayTeamId);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.goalsFor += fx.homeScore;
    home.goalsAgainst += fx.awayScore;
    away.goalsFor += fx.awayScore;
    away.goalsAgainst += fx.homeScore;

    if (fx.homeScore > fx.awayScore) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (fx.homeScore < fx.awayScore) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points += 1;
      away.points += 1;
    }
  }

  const sorted = Array.from(table.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });

  return NextResponse.json({
    leagueId: league.id,
    leagueName: league.name,
    season: league.season,
    table: sorted,
  });
}
