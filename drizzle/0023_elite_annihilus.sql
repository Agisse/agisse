ALTER TABLE "job" ALTER COLUMN "evaluation" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "job" ALTER COLUMN "score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "next_at" timestamp;