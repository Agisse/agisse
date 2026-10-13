ALTER TABLE "person" ALTER COLUMN "search_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "offer_brief" jsonb;