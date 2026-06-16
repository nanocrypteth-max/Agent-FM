import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

const NEWS_TOPICS = [
  "A star player from one of the AI-managed clubs suffers an injury setback",
  "Match analyst reveals tactical breakdown of recent league fixtures",
  "Transfer rumor: high-rated striker linked with multiple clubs",
  "League commissioner announces rule changes for next season",
  "Rising youngster makes breakthrough with impressive performances",
  "Former champion club struggles mid-table after controversial decisions",
  "Sports scientist reveals new training method boosting player stamina",
  "Financial fair play: club faces investigation over transfer spending",
  "Record attendance expected for upcoming top-of-the-table clash",
  "International break forces key players to miss upcoming fixtures",
];

export async function generatePortalNews(): Promise<void> {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your-gemini-api-key-here") {
    // Fallback: create a static news item
    await prisma.portalMessage.create({
      data: {
        type: "NEWS",
        title: "Transfer Window Heats Up",
        content: "Multiple clubs are reportedly scouting top talent ahead of the transfer window. The market is expected to be highly competitive this season.",
      },
    });
    return;
  }

  // Fetch league context for relevant news
  const league = await prisma.league.findFirst({
    include: { teams: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const teamNames = league?.teams.map((t) => t.name).join(", ") ?? "various clubs";
  const selectedTopics = NEWS_TOPICS.sort(() => Math.random() - 0.5).slice(0, 3);

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  for (const topic of selectedTopics) {
    try {
      const prompt = `You are a football news journalist for the World Stage 2026 league, which features teams: ${teamNames}.

Write a short, engaging football news article (2-3 sentences) about the following topic: "${topic}".

Respond ONLY with JSON (no markdown, no backticks):
{"title": "...", "content": "..."}

Keep it punchy and dramatic, like a real sports headline.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(text);

      if (parsed.title && parsed.content) {
        await prisma.portalMessage.create({
          data: {
            type: "NEWS",
            title: parsed.title,
            content: parsed.content,
          },
        });
      }
    } catch (err) {
      console.error("[portal-news] Failed to generate article:", err);
    }
  }
}
