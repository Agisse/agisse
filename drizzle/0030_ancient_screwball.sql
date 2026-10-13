ALTER TABLE "user" ADD COLUMN "referral_code" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "referred_by" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_referral_code_unique" UNIQUE("referral_code");--> statement-breakpoint
UPDATE "user" SET "referral_code" = substr(md5("id"), 1, 8) WHERE "referral_code" IS NULL;--> statement-breakpoint
CREATE INDEX "user_referred_by_idx" ON "user" ("referred_by");
