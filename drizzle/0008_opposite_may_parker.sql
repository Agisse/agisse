CREATE TABLE "assessment_intel" (
	"id" text PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"company_key" text NOT NULL,
	"role_pattern" text,
	"location" text,
	"provider" text,
	"assessment_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"game_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"weights_estimated" boolean DEFAULT true NOT NULL,
	"stages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"difficulty" text,
	"time_limits" text,
	"scoring_dimensions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_date" date NOT NULL,
	"confidence" text NOT NULL,
	"origin" text NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_report" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company" text NOT NULL,
	"company_key" text NOT NULL,
	"job_id" text,
	"kind" text NOT NULL,
	"detail" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text,
	"mode" text NOT NULL,
	"game_id" text NOT NULL,
	"duration_sec" integer NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessment_intel" ADD CONSTRAINT "assessment_intel_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_report" ADD CONSTRAINT "assessment_report_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_report" ADD CONSTRAINT "assessment_report_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessment_intel_company_idx" ON "assessment_intel" USING btree ("company_key");--> statement-breakpoint
CREATE INDEX "assessment_report_company_idx" ON "assessment_report" USING btree ("company_key","created_at");--> statement-breakpoint
CREATE INDEX "training_session_user_created_idx" ON "training_session" USING btree ("user_id","created_at");