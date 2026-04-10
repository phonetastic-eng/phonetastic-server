-- Phase A: Add ownership FK columns to phone_numbers
ALTER TABLE "phone_numbers" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD COLUMN "end_user_id" integer;--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD COLUMN "contact_id" integer;--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD COLUMN "bot_id" integer;--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_end_user_id_end_users_id_fk" FOREIGN KEY ("end_user_id") REFERENCES "public"."end_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "phone_numbers_user_id_idx" ON "phone_numbers" ("user_id");--> statement-breakpoint
CREATE INDEX "phone_numbers_end_user_id_idx" ON "phone_numbers" ("end_user_id");--> statement-breakpoint
CREATE INDEX "phone_numbers_bot_id_idx" ON "phone_numbers" ("bot_id");--> statement-breakpoint
CREATE INDEX "phone_numbers_contact_e164_idx" ON "phone_numbers" ("phone_number_e164","contact_id");--> statement-breakpoint

-- Phase B: Backfill ownership columns from existing data
UPDATE "phone_numbers" pn
SET user_id = u.id
FROM "users" u
WHERE u.phone_number_id = pn.id;--> statement-breakpoint

UPDATE "phone_numbers" pn
SET end_user_id = eu.id
FROM "end_users" eu
WHERE eu.phone_number_id = pn.id;--> statement-breakpoint

UPDATE "phone_numbers" pn
SET bot_id = b.id
FROM "bots" b
WHERE b.phone_number_id = pn.id;--> statement-breakpoint

INSERT INTO "phone_numbers" ("phone_number_e164", "contact_id")
SELECT cpn.phone_number_e164, cpn.contact_id
FROM "contact_phone_numbers" cpn;--> statement-breakpoint

-- Phase D: Drop old FK columns and contact_phone_numbers table
ALTER TABLE "users" DROP COLUMN "phone_number_id";--> statement-breakpoint
ALTER TABLE "end_users" DROP COLUMN "phone_number_id";--> statement-breakpoint
ALTER TABLE "bots" DROP COLUMN "phone_number_id";--> statement-breakpoint
DROP TABLE "contact_phone_numbers";
