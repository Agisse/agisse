ALTER TABLE "search" ADD COLUMN "domain" text;--> statement-breakpoint
ALTER TABLE "search" ADD COLUMN "contact_types" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "search" ADD COLUMN "shared_only" boolean DEFAULT false NOT NULL;