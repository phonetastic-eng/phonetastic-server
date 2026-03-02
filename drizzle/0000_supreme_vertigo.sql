CREATE TYPE "public"."calendar_provider" AS ENUM('google');--> statement-breakpoint
CREATE TYPE "public"."call_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."call_state" AS ENUM('waiting', 'connecting', 'connected', 'finished', 'failed');--> statement-breakpoint
CREATE TYPE "public"."carrier" AS ENUM('livekit', 'twilio', 'att', 'verizon');--> statement-breakpoint
CREATE TYPE "public"."participant_type" AS ENUM('agent', 'bot', 'end_user');--> statement-breakpoint
CREATE TABLE "phone_numbers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"phone_number_e164" varchar(20) NOT NULL,
	"carrier" "carrier" NOT NULL,
	"is_verified" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"business_type" varchar(255),
	"website" varchar(2048),
	"email" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone_number_id" integer NOT NULL,
	"company_id" integer,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255),
	"jwt_private_key" varchar(4096) NOT NULL,
	"jwt_public_key" varchar(4096) NOT NULL,
	"access_token_nonce" integer DEFAULT 0 NOT NULL,
	"refresh_token_nonce" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"bot_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"call_greeting_message" varchar(1024),
	"call_goodbye_message" varchar(1024),
	"voice_id" integer NOT NULL,
	"primary_language" varchar(10) DEFAULT 'en' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"settings_schema" jsonb,
	"params_schema" jsonb
);
--> statement-breakpoint
CREATE TABLE "bot_skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"is_enabled" boolean DEFAULT false,
	"skill_id" integer NOT NULL,
	"bot_id" integer NOT NULL,
	"settings" jsonb
);
--> statement-breakpoint
CREATE TABLE "calendars" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"provider" "calendar_provider" NOT NULL,
	"email" varchar(255) NOT NULL,
	"access_token" varchar(4096) NOT NULL,
	"refresh_token" varchar(4096) NOT NULL,
	"token_expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_call_id" varchar(255) NOT NULL,
	"company_id" integer NOT NULL,
	"from_phone_number_id" integer NOT NULL,
	"to_phone_number_id" integer NOT NULL,
	"state" "call_state" DEFAULT 'connecting' NOT NULL,
	"direction" "call_direction" DEFAULT 'inbound' NOT NULL,
	"test_mode" boolean DEFAULT false NOT NULL,
	"failure_reason" varchar(1024),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer,
	"bot_id" integer,
	"user_id" integer,
	"end_user_id" integer,
	"company_id" integer,
	"call_id" integer NOT NULL,
	"type" "participant_type" NOT NULL,
	"state" "call_state" DEFAULT 'connecting' NOT NULL,
	"failure_reason" varchar(1024)
);
--> statement-breakpoint
CREATE TABLE "call_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"forwarded_phone_number_id" integer NOT NULL,
	"company_phone_number_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"is_bot_enabled" boolean DEFAULT false NOT NULL,
	"rings_before_bot_answer" integer DEFAULT 3 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "end_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone_number_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"first_name" varchar(255),
	"last_name" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "otps" (
	"id" serial PRIMARY KEY NOT NULL,
	"expires_at" bigint NOT NULL,
	"password" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voices" (
	"id" serial PRIMARY KEY NOT NULL,
	"supported_languages" text[] DEFAULT '{"en"}' NOT NULL,
	"name" varchar(255) NOT NULL,
	"snippet" varchar(65535) NOT NULL,
	"snippet_mime_type" varchar(255) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bots" ADD CONSTRAINT "bots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_settings" ADD CONSTRAINT "bot_settings_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_settings" ADD CONSTRAINT "bot_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_settings" ADD CONSTRAINT "bot_settings_voice_id_voices_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_skills" ADD CONSTRAINT "bot_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_skills" ADD CONSTRAINT "bot_skills_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_from_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("from_phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_to_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("to_phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_settings" ADD CONSTRAINT "call_settings_forwarded_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("forwarded_phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_settings" ADD CONSTRAINT "call_settings_company_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("company_phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_settings" ADD CONSTRAINT "call_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "end_users" ADD CONSTRAINT "end_users_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "end_users" ADD CONSTRAINT "end_users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;