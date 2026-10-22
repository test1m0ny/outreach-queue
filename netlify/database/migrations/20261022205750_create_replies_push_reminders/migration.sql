CREATE TABLE "push_subscriptions" (
	"endpoint" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"user_id" text,
	"lead_id" text,
	"lead_name" text DEFAULT '' NOT NULL,
	"kind" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"notified_at" timestamp with time zone,
	CONSTRAINT "reminders_pkey" PRIMARY KEY("user_id","lead_id")
);
--> statement-breakpoint
CREATE TABLE "replies" (
	"id" serial PRIMARY KEY,
	"user_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"lead_name" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"outcome" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"later_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "reminders_due_idx" ON "reminders" ("due_at");--> statement-breakpoint
CREATE INDEX "replies_user_idx" ON "replies" ("user_id","created_at");