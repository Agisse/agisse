CREATE TABLE "saved_company" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company_key" text NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"why" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scout" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"input" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"model" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_company" ADD CONSTRAINT "saved_company_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scout" ADD CONSTRAINT "scout_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_company_user_key_idx" ON "saved_company" USING btree ("user_id","company_key");--> statement-breakpoint
CREATE INDEX "scout_user_created_idx" ON "scout" USING btree ("user_id","created_at");