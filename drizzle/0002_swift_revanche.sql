CREATE TYPE "public"."offering_type" AS ENUM('product', 'service');--> statement-breakpoint
CREATE TYPE "public"."price_frequency" AS ENUM('one_time', 'hourly', 'daily', 'weekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offerings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"type" "offering_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"price_amount" numeric,
	"price_currency" varchar(10),
	"price_frequency" "price_frequency"
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "business_hours" text;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;