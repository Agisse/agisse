ALTER TABLE "job" ADD COLUMN "history" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "offer" jsonb;