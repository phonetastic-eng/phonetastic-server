DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bots' AND column_name='settings') THEN
    ALTER TABLE "bots" RENAME COLUMN "settings" TO "call_settings";
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "bots" ADD COLUMN IF NOT EXISTS "appointment_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='appointment_booking_settings') THEN
    UPDATE "bots"
    SET "appointment_settings" = jsonb_build_object(
      'isEnabled', abs."is_enabled",
      'triggers', abs."triggers",
      'instructions', abs."instructions"
    )
    FROM "appointment_booking_settings" abs
    WHERE abs."bot_id" = "bots"."id";
  END IF;
END $$;
--> statement-breakpoint
DROP TABLE IF EXISTS "appointment_booking_settings" CASCADE;
