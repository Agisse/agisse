CREATE TABLE "programme" (
	"url" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"degree" text,
	"institution" text NOT NULL,
	"school" text,
	"domain" text,
	"country" text,
	"city" text,
	"fields" text[] DEFAULT '{}'::text[] NOT NULL,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"duration_months" integer,
	"tuition_eur" integer,
	"study_mode" text,
	"start_date" date,
	"deadline" date,
	"deadline_type" text DEFAULT 'unknown' NOT NULL,
	"description" text,
	"rank_the" integer,
	"rank_qs" integer,
	"rank_ft" integer,
	"first_seen" date NOT NULL,
	"last_seen" date NOT NULL,
	"closed_at" date,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(institution, '') || ' ' || coalesce(left(description, 2000), ''))) STORED,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_programme" (
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saved_programme_user_id_url_pk" PRIMARY KEY("user_id","url")
);
--> statement-breakpoint
ALTER TABLE "saved_programme" ADD CONSTRAINT "saved_programme_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_programme" ADD CONSTRAINT "saved_programme_url_programme_url_fk" FOREIGN KEY ("url") REFERENCES "public"."programme"("url") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "programme_country_kind_idx" ON "programme" USING btree ("country","kind");--> statement-breakpoint
CREATE INDEX "programme_deadline_idx" ON "programme" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "programme_fields_idx" ON "programme" USING gin ("fields");--> statement-breakpoint
CREATE INDEX "programme_search_idx" ON "programme" USING gin ("search");