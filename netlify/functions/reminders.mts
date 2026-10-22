import type { Config } from "@netlify/functions";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { reminders } from "../../db/schema.js";
import { getUser, unauthorized } from "../lib/auth.js";

// The app sends the full list of upcoming follow-ups whenever it loads, replacing what was stored before.
export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const user = await getUser(req);
  if (!user) return unauthorized();
  const { items } = await req.json().catch(() => ({ items: [] }));
  const rows = (Array.isArray(items) ? items : [])
    .slice(0, 5000)
    .map((i: any) => ({
      userId: user.id,
      leadId: String(i.lead_id),
      leadName: String(i.name || "").slice(0, 200),
      kind: i.kind === "checkin" ? "checkin" : "followup",
      dueAt: new Date(i.due_at),
    }))
    .filter((r) => r.leadId && !isNaN(+r.dueAt));

  const ids = rows.map((r) => r.leadId);
  await db.delete(reminders).where(ids.length ? and(eq(reminders.userId, user.id), notInArray(reminders.leadId, ids)) : eq(reminders.userId, user.id));
  if (rows.length) {
    await db
      .insert(reminders)
      .values(rows)
      .onConflictDoUpdate({
        target: [reminders.userId, reminders.leadId],
        set: {
          leadName: sql`excluded.lead_name`,
          kind: sql`excluded.kind`,
          dueAt: sql`excluded.due_at`,
          // Keep the "already notified" mark only if the due time hasn't moved.
          notifiedAt: sql`case when ${reminders.dueAt} = excluded.due_at then ${reminders.notifiedAt} else null end`,
        },
      });
  }
  return Response.json({ ok: true, count: rows.length });
};

export const config: Config = { path: "/api/reminders" };
