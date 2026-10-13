CREATE TABLE "invite" (
	"code" text PRIMARY KEY NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"used_at" timestamp,
	"used_by" text,
	"revoked_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_used_by_user_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;