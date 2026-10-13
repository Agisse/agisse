ALTER TABLE "job" ADD COLUMN "cover_edited" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "outreach_edited" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN "task" text;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN "prompt" text;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN "failed" jsonb;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN "ref_id" text;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN "output" jsonb;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN "flags" jsonb;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN "rating" smallint;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN "note" text;--> statement-breakpoint
CREATE INDEX "usage_task_ref_idx" ON "usage" USING btree ("task","ref_id");