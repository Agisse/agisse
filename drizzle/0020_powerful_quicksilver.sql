CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "profile_embedding" (
	"user_id" text PRIMARY KEY NOT NULL,
	"embedding" halfvec(384) NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "deadline_type" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "closed_at" date;--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "level" text;--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "program" text;--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "functions" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "industry" text;--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "langs_required" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "embedding" halfvec(384);--> statement-breakpoint
ALTER TABLE "vacancy" ADD COLUMN "search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(company, '') || ' ' || coalesce(left(description, 2000), ''))) STORED;--> statement-breakpoint
ALTER TABLE "profile_embedding" ADD CONSTRAINT "profile_embedding_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vacancy_country_level_idx" ON "vacancy" USING btree ("country","level");--> statement-breakpoint
CREATE INDEX "vacancy_first_seen_idx" ON "vacancy" USING btree ("first_seen");--> statement-breakpoint
CREATE INDEX "vacancy_functions_idx" ON "vacancy" USING gin ("functions");--> statement-breakpoint
CREATE INDEX "vacancy_search_idx" ON "vacancy" USING gin ("search");