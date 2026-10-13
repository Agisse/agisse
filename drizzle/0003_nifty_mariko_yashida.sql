ALTER TABLE "user" ADD COLUMN "access_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "user" SET "access_status" = 'approved', "reviewed_at" = now();
