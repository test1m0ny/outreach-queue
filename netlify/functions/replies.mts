import type { Config } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { replies } from "../../db/schema.js";
import { getUser, unauthorized } from "../lib/auth.js";

const OUTCOMES = ["interested", "replied", "later", "stop"] as const;
type Outcome = (typeof OUTCOMES)[number];

const anthropic = new Anthropic();

// Reads a lead's WhatsApp reply and decides what it means for the outreach.
async function classify(text: string, today: string) {
  const msg = await anthropic.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 300,
    system:
      "You sort WhatsApp replies from small businesses that received a cold outreach message offering a service. " +
      "Pick exactly one outcome: " +
      '"interested" (they want the demo, said yes, replied 1, or asked to see it), ' +
      '"replied" (they asked a question or said something that needs a personal answer), ' +
      '"later" (not now, busy, try again another time), ' +
      '"stop" (not interested, wrong number, replied 3, asked not to be contacted). ' +
      `Today is ${today}. For "later", give the date they suggested as YYYY-MM-DD, or 30 days from today if none. ` +
      'Respond with only JSON: {"outcome": "...", "later_date": "YYYY-MM-DD" or null, "summary": "one short sentence"}',
    messages: [{ role: "user", content: text.slice(0, 4000) }],
  });
  const raw = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  let parsed: { outcome?: string; later_date?: string | null; summary?: string } = {};
  try {
    parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch {}
  const outcome: Outcome = OUTCOMES.includes(parsed.outcome as Outcome) ? (parsed.outcome as Outcome) : "replied";
  let laterDate: Date | null = null;
  if (outcome === "later") {
    const d = parsed.later_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.later_date) ? new Date(parsed.later_date + "T09:00:00Z") : null;
    laterDate = d && !isNaN(+d) && +d > Date.now() ? d : new Date(Date.now() + 30 * 864e5);
  }
  return { outcome, laterDate, summary: String(parsed.summary || "").slice(0, 300) };
}

export default async (req: Request) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  if (req.method === "GET") {
    const rows = await db.select().from(replies).where(eq(replies.userId, user.id)).orderBy(desc(replies.createdAt)).limit(300);
    return Response.json(rows);
  }

  if (req.method === "POST") {
    const { lead_id, campaign_id, lead_name, text } = await req.json().catch(() => ({}));
    const body = String(text || "").trim();
    if (!lead_id || !campaign_id || !body) return Response.json({ error: "Paste the reply first." }, { status: 400 });
    const result = await classify(body, new Date().toISOString().slice(0, 10));
    const [row] = await db
      .insert(replies)
      .values({
        userId: user.id,
        leadId: String(lead_id),
        campaignId: String(campaign_id),
        leadName: String(lead_name || "").slice(0, 200),
        body: body.slice(0, 4000),
        outcome: result.outcome,
        summary: result.summary,
        laterDate: result.laterDate,
      })
      .returning();
    return Response.json(row, { status: 201 });
  }

  if (req.method === "DELETE") {
    const id = Number(new URL(req.url).searchParams.get("id"));
    await db.delete(replies).where(and(eq(replies.id, id), eq(replies.userId, user.id)));
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/replies" };
