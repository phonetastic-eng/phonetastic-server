CREATE TABLE "appointment_booking_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"bot_id" integer NOT NULL,
	"triggers" text,
	"instructions" text,
	"is_enabled" boolean DEFAULT false NOT NULL,
	CONSTRAINT "appointment_booking_settings_bot_id_unique" UNIQUE("bot_id")
);
--> statement-breakpoint
ALTER TABLE "appointment_booking_settings" ADD CONSTRAINT "appointment_booking_settings_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE no action ON UPDATE no action;