CREATE TABLE "company" (
	"domain" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"facts" jsonb,
	"facts_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posting" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"url" text,
	"jd_text" text NOT NULL,
	"company" text NOT NULL,
	"role" text NOT NULL,
	"location" text,
	"domain" text,
	"facts" jsonb NOT NULL,
	"seen_count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "posting_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "practice_answer" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"feedback" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "posting_id" text;--> statement-breakpoint
ALTER TABLE "practice_answer" ADD CONSTRAINT "practice_answer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_answer" ADD CONSTRAINT "practice_answer_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "practice_answer_job_idx" ON "practice_answer" USING btree ("job_id","created_at");--> statement-breakpoint
ALTER TABLE "job" ADD CONSTRAINT "job_posting_id_posting_id_fk" FOREIGN KEY ("posting_id") REFERENCES "public"."posting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_posting_idx" ON "job" USING btree ("posting_id","user_id");