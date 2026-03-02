CREATE TABLE "addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"street_address" varchar(500),
	"city" varchar(255),
	"state" varchar(255),
	"postal_code" varchar(20),
	"country" varchar(255),
	"label" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "operation_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"open_time" varchar(5) NOT NULL,
	"close_time" varchar(5) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD COLUMN "label" varchar(100);