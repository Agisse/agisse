CREATE TABLE "cv_review_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"score" integer NOT NULL,
	"failed" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_question_set" (
	"id" text PRIMARY KEY NOT NULL,
	"company_key" text NOT NULL,
	"role_key" text NOT NULL,
	"questions" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "practice_answer" ADD COLUMN "source" text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_answer" ADD COLUMN "delivery" jsonb;--> statement-breakpoint
ALTER TABLE "cv_review_log" ADD CONSTRAINT "cv_review_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cv_review_log_user_idx" ON "cv_review_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "interview_question_set_key" ON "interview_question_set" USING btree ("company_key","role_key");--> statement-breakpoint
CREATE INDEX "practice_answer_user_idx" ON "practice_answer" USING btree ("user_id","created_at");--> statement-breakpoint
-- Seed history with each user's latest CV review so progress has a starting point.
INSERT INTO "cv_review_log" ("id", "user_id", "score", "failed", "created_at") SELECT gen_random_uuid()::text, "user_id", ("cv_review"->>'score')::int, "cv_review"->'failed', ("cv_review"->>'at')::timestamp FROM "profile" WHERE "cv_review" IS NOT NULL;
