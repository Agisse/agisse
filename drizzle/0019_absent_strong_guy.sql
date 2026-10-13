CREATE TABLE "vacancy" (
	"url" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"company" text NOT NULL,
	"domain" text,
	"title" text NOT NULL,
	"location" text,
	"country" text,
	"city" text,
	"remote" boolean DEFAULT false NOT NULL,
	"description" text,
	"posted_at" date,
	"deadline" date,
	"first_seen" date NOT NULL,
	"last_seen" date NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "vacancy_deadline_idx" ON "vacancy" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "vacancy_domain_idx" ON "vacancy" USING btree ("domain");