CREATE TABLE "feed_day" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"pages" integer NOT NULL,
	CONSTRAINT "feed_day_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "feed_day" ADD CONSTRAINT "feed_day_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;