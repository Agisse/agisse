CREATE TABLE "usage" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"tokens" integer NOT NULL,
	"cost_usd" double precision NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "budget_eur" double precision;--> statement-breakpoint
ALTER TABLE "usage" ADD CONSTRAINT "usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_user_created_idx" ON "usage" USING btree ("user_id","created_at");