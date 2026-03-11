CREATE TABLE "skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"allowed_tools" text[] DEFAULT '{}' NOT NULL,
	"description" text NOT NULL,
	"instructions" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"skill_id" integer NOT NULL,
	"bot_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bot_skills" ADD CONSTRAINT "bot_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_skills" ADD CONSTRAINT "bot_skills_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE no action ON UPDATE no action;