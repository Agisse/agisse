ALTER TABLE "user" ALTER COLUMN "access_status" SET DEFAULT 'approved';--> statement-breakpoint
UPDATE "user" SET "access_status" = 'approved', "reviewed_at" = now() WHERE "access_status" = 'pending';
