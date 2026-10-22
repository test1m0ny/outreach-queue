import type { Config } from "@netlify/functions";
import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { pushSubscriptions, reminders } from "../../db/schema.js";
import { sendPush } from "../lib/push.js";

// Runs every hour and sends one push notification per user listing follow-ups that just fell due.
export default async () => {
  const due = await db
    .select()
    .from(reminders)
    .where(and(lte(reminders.dueAt, new Date()), isNull(reminders.notifiedAt)))
    .limit(2000);
  const byUser = new Map<string, typeof due>();
  for (const r of due) byUser.set(r.userId, [...(byUser.get(r.userId) || []), r]);

  for (const [userId, items] of byUser) {
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    const names = items.slice(0, 3).map((i) => i.leadName).join(", ");
    const more = items.length > 3 ? ` and ${items.length - 3} more` : "";
    const payload = {
      title: items.length === 1 ? "Follow-up due" : `${items.length} follow-ups due`,
      body: `${names}${more}. Open Outreach Queue to send.`,
      url: "/",
    };
    for (const s of subs) {
      try {
        await sendPush(s, payload);
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint));
      }
    }
    await db
      .update(reminders)
      .set({ notifiedAt: new Date() })
      .where(and(eq(reminders.userId, userId), inArray(reminders.leadId, items.map((i) => i.leadId))));
  }
};

export const config: Config = { schedule: "@hourly" };
