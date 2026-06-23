import { prisma } from "@/lib/prisma";

// Static news templates — no Gemini dependency.
// Rotated daily based on date seed for variety without AI quota usage.
const NEWS_POOL = [
  {
    title: "Transfer Window Heats Up",
    content:
      "Multiple clubs are reportedly scouting top talent ahead of the transfer window. Competition for marquee signings is expected to be fierce this season.",
  },
  {
    title: "Tactical Breakdown: High Press Dominates Latest Fixtures",
    content:
      "Analysts highlight a growing trend of high-press formations leading to more goals in the opening 20 minutes. Teams adapting fastest are climbing the table.",
  },
  {
    title: "Injury Crisis Hits Top Clubs",
    content:
      "Several high-profile squads are dealing with key absences after a congested fixture schedule. Rotation depth will prove decisive in the title race.",
  },
  {
    title: "Rising Stars Steal the Spotlight",
    content:
      "Young players are making waves across the league with standout performances. Scouts from rival clubs have taken notice of several breakthrough talents.",
  },
  {
    title: "Financial Fair Play Warning Issued",
    content:
      "League officials have flagged two clubs for excessive transfer spending relative to revenue. Both are expected to operate on tight budgets next window.",
  },
  {
    title: "Top-of-the-Table Clash Approaches",
    content:
      "The upcoming fixture between the league's top two sides is drawing massive attention. Both managers have played down pressure despite the stakes involved.",
  },
  {
    title: "Sports Science: New Stamina Methods Unveiled",
    content:
      "A leading performance team has published research on high-altitude training protocols showing a 12% improvement in late-game sprint output among test squads.",
  },
  {
    title: "Controversial Refereeing Decisions Spark Debate",
    content:
      "Match officials came under scrutiny this week after several contentious calls altered the outcome of key fixtures. The league is reviewing video evidence.",
  },
  {
    title: "Record Attendances Expected This Weekend",
    content:
      "Ticket demand for this weekend's top fixtures has reached a seasonal high. Stadium operators are bracing for near-capacity crowds across multiple venues.",
  },
  {
    title: "International Break Disrupts League Momentum",
    content:
      "Clubs are managing key players returning from international duty with limited recovery time. Fitness coaches are prioritising rotation for the next round.",
  },
  {
    title: "Manager Under Pressure After Three Straight Defeats",
    content:
      "Board confidence is wavering at one mid-table club following a winless run. Sources indicate emergency talks are planned before the next fixture.",
  },
  {
    title: "Set-Piece Specialists Prove Their Worth",
    content:
      "League data shows that 28% of goals this season have come from set pieces — the highest recorded rate in recent years. Recruitment is shifting accordingly.",
  },
];

// Pick N articles from the pool based on a daily seed for deterministic daily rotation
function getDailyArticles(count = 3): typeof NEWS_POOL {
  const seed = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let hash = 0;
  for (const ch of seed) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;

  const pool = [...NEWS_POOL];
  const selected = [];
  let idx = Math.abs(hash) % pool.length;

  for (let i = 0; i < count && pool.length; i++) {
    idx = (idx + 7) % pool.length; // stride of 7 for spread
    selected.push(pool.splice(idx % pool.length, 1)[0]);
  }
  return selected;
}

export async function generatePortalNews(): Promise<void> {
  const articles = getDailyArticles(3);

  await Promise.all(
    articles.map((article) =>
      prisma.portalMessage.create({
        data: {
          type: "NEWS",
          title: article.title,
          content: article.content,
        },
      }),
    ),
  );
}
