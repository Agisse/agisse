CREATE TABLE "sponsor" (
	"key" text NOT NULL,
	"country" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "sponsor_key_country_pk" PRIMARY KEY("key","country")
);
