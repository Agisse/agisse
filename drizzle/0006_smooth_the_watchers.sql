CREATE TABLE "exa_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"results" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "followed_up_at" timestamp;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "prep" jsonb;--> statement-breakpoint
UPDATE "person" SET "status" = 'contacted' WHERE "contacted_at" IS NOT NULL;