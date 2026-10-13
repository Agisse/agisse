CREATE TABLE "job" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company" text NOT NULL,
	"role" text NOT NULL,
	"url" text,
	"location" text,
	"jd_text" text NOT NULL,
	"evaluation" jsonb NOT NULL,
	"score" double precision NOT NULL,
	"status" text DEFAULT 'evaluated' NOT NULL,
	"cv" jsonb,
	"cover_letter" text,
	"notes" text,
	"applied_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "resume_text" text;--> statement-breakpoint
ALTER TABLE "job" ADD CONSTRAINT "job_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_user_created_idx" ON "job" USING btree ("user_id","created_at");