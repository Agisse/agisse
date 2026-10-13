CREATE TABLE "vacancy_fit" (
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"score" double precision NOT NULL,
	"profile_at" timestamp NOT NULL,
	CONSTRAINT "vacancy_fit_user_id_url_pk" PRIMARY KEY("user_id","url")
);
--> statement-breakpoint
ALTER TABLE "vacancy_fit" ADD CONSTRAINT "vacancy_fit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancy_fit" ADD CONSTRAINT "vacancy_fit_url_vacancy_url_fk" FOREIGN KEY ("url") REFERENCES "public"."vacancy"("url") ON DELETE cascade ON UPDATE no action;