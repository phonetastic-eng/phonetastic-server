ALTER TABLE "bots" ADD COLUMN "voice_id" integer;--> statement-breakpoint
ALTER TABLE "bots" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "bots" ADD CONSTRAINT "bots_voice_id_voices_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "bots" SET
  "voice_id" = bs."voice_id",
  "settings" = jsonb_build_object(
    'callGreetingMessage', bs."call_greeting_message",
    'callGoodbyeMessage', bs."call_goodbye_message",
    'primaryLanguage', bs."primary_language"
  )
FROM "bot_settings" bs WHERE bs."bot_id" = "bots"."id";--> statement-breakpoint
ALTER TABLE "bot_settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "bot_settings" CASCADE;
