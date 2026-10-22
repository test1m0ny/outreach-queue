import type { Config, Context } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { pushSubscriptions } from "../../db/schema.js";
import { getUser, unauthorized } from "../lib/auth.js";
import { sendPush, vapidKeys } from "../lib/push.js";

export default async (req: Request, context: Context) => {
  const action = context.params.action;

  if (action === "key" && req.method === "GET") {
    return Response.json({ publicKey: (await vapidKeys()).publicKey });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const user = await getUser(req);
  if (!user) return unauthorized();
  const body = await req.json().catch(() => ({}));

  if (action === "subscribe") {
    const { endpoint, keys } = body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) return Response.json({ error: "Invalid subscription." }, { status: 400 });
    const row = { endpoint, userId: user.id, p256dh: keys.p256dh, auth: keys.auth };
    await db.insert(pushSubscriptions).values(row).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: row });
    return Response.json({ ok: true });
  }

  if (action === "unsubscribe") {
    if (body?.endpoint) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, String(body.endpoint)));
    return Response.json({ ok: true });
  }

  if (action === "test") {
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id));
    let sent = 0;
    for (const s of subs) {
      try {
        await sendPush(s, { title: "Outreach Queue", body: "Notifications are working. You'll hear from us when follow-ups are due." });
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint));
      }
    }
    return Response.json({ sent });
  }

  return new Response("Not found", { status: 404 });
};

export const config: Config = { path: "/api/push/:action" };
