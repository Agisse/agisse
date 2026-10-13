CREATE TABLE "selection_intel" (
	"id" text PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"company_key" text NOT NULL,
	"role_pattern" text,
	"location" text,
	"stages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"values" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timeline" text,
	"difficulty" text,
	"advice" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pitfalls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_date" date NOT NULL,
	"confidence" text NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "selection_intel" ADD CONSTRAINT "selection_intel_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "selection_intel_company_idx" ON "selection_intel" USING btree ("company_key");