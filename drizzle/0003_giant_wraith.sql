ALTER TABLE "bot_skills" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "bot_skills" CASCADE;--> statement-breakpoint
ALTER TABLE "skills" DROP COLUMN "instructions";--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_name_unique" UNIQUE("name");