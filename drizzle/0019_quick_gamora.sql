CREATE TYPE "public"."sms_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."sms_state" AS ENUM('pending', 'sent', 'delivered', 'failed', 'received');--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"from_phone_number_id" integer NOT NULL,
	"to_phone_number_id" integer NOT NULL,
	"body" text NOT NULL,
	"direction" "sms_direction" NOT NULL,
	"state" "sms_state" DEFAULT 'pending' NOT NULL,
	"external_message_sid" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_from_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("from_phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_to_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("to_phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action;