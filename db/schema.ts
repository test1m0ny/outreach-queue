import { pgTable, serial, text, timestamp, primaryKey, index } from "drizzle-orm/pg-core";

// Replies logged by the AI reply logger. Lead and campaign IDs refer to rows in Supabase.
export const replies = pgTable(
  "replies",
  {
    id: serial().primaryKey(),
    userId: text("user_id").notNull(),
    leadId: text("lead_id").notNull(),
    campaignId: text("campaign_id").notNull(),
    leadName: text("lead_name").notNull().default(""),
    body: text().notNull(),
    outcome: text().notNull(),
    summary: text().notNull().default(""),
    laterDate: timestamp("later_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("replies_user_idx").on(t.userId, t.createdAt)],
);

// Web push subscriptions, one per browser/device.
export const pushSubscriptions = pgTable("push_subscriptions", {
  endpoint: text().primaryKey(),
  userId: text("user_id").notNull(),
  p256dh: text().notNull(),
  auth: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// When each lead's next follow-up or check-in falls due, synced from the app.
export const reminders = pgTable(
  "reminders",
  {
    userId: text("user_id").notNull(),
    leadId: text("lead_id").notNull(),
    leadName: text("lead_name").notNull().default(""),
    kind: text().notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.leadId] }), index("reminders_due_idx").on(t.dueAt)],
);
