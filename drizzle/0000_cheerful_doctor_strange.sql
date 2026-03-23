CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."answer_calls_from" AS ENUM('everyone', 'unknown', 'contacts'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."attachment_status" AS ENUM('pending', 'stored', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."calendar_provider" AS ENUM('google'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."call_direction" AS ENUM('inbound', 'outbound'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."call_state" AS ENUM('waiting', 'connecting', 'connected', 'finished', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."chat_channel" AS ENUM('email'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."chat_status" AS ENUM('open', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."email_direction" AS ENUM('inbound', 'outbound'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."email_status" AS ENUM('received', 'pending', 'sent', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."offering_type" AS ENUM('product', 'service'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."participant_type" AS ENUM('agent', 'bot', 'end_user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."price_frequency" AS ENUM('one_time', 'hourly', 'daily', 'weekly', 'monthly', 'yearly'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."sms_direction" AS ENUM('inbound', 'outbound'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."sms_state" AS ENUM('pending', 'sent', 'delivered', 'failed', 'received'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."subdomain_status" AS ENUM('not_started', 'pending', 'verified', 'partially_verified', 'partially_failed', 'failed', 'temporary_failure'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "phone_numbers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"phone_number_e164" varchar(20) NOT NULL,
	"is_verified" boolean DEFAULT false,
	"label" varchar(100)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"business_type" varchar(255),
	"website" varchar(2048),
	"emails" varchar(255)[] DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
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
CREATE TABLE IF NOT EXISTS "bots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone_number_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bot_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"bot_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"call_greeting_message" varchar(1024),
	"call_goodbye_message" varchar(1024),
	"voice_id" integer NOT NULL,
	"primary_language" varchar(10) DEFAULT 'en' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"allowed_tools" text[] DEFAULT '{}' NOT NULL,
	"description" text NOT NULL,
	"instructions" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bot_skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"skill_id" integer NOT NULL,
	"bot_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendars" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"provider" "calendar_provider" NOT NULL,
	"external_id" varchar(255),
	"name" varchar(255),
	"description" varchar(1024),
	"email" varchar(255) NOT NULL,
	"access_token" varchar(4096) NOT NULL,
	"refresh_token" varchar(4096) NOT NULL,
	"token_expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calls" (
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
CREATE TABLE IF NOT EXISTS "call_participants" (
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
CREATE TABLE IF NOT EXISTS "call_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"forwarded_phone_number_id" integer NOT NULL,
	"company_phone_number_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"is_bot_enabled" boolean DEFAULT false NOT NULL,
	"rings_before_bot_answer" integer DEFAULT 3 NOT NULL,
	"answer_calls_from" "answer_calls_from" DEFAULT 'everyone' NOT NULL,
	"sip_dispatch_rule_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "end_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone_number_id" integer,
	"company_id" integer NOT NULL,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"email" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voices" (
	"id" serial PRIMARY KEY NOT NULL,
	"supported_languages" text[] DEFAULT '{"en"}' NOT NULL,
	"name" varchar(255) NOT NULL,
	"snippet" "bytea" NOT NULL,
	"snippet_mime_type" varchar(255) NOT NULL,
	"external_id" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "faqs" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"embedding" vector(1536)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offerings" (
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
CREATE TABLE IF NOT EXISTS "addresses" (
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
CREATE TABLE IF NOT EXISTS "operation_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"open_time" varchar(8) NOT NULL,
	"close_time" varchar(8) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "call_transcripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"call_id" integer NOT NULL,
	"summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "call_transcript_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"transcript_id" integer NOT NULL,
	"text" text NOT NULL,
	"end_user_id" integer,
	"bot_id" integer,
	"user_id" integer,
	"sequence_number" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sms_messages" (
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
CREATE TABLE IF NOT EXISTS "email_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"address" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_addresses_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"end_user_id" integer NOT NULL,
	"channel" "chat_channel" NOT NULL,
	"status" "chat_status" DEFAULT 'open' NOT NULL,
	"bot_enabled" boolean DEFAULT true NOT NULL,
	"subject" varchar(1024),
	"summary" text,
	"from" varchar(512),
	"to" varchar(512),
	"email_address_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" integer NOT NULL,
	"direction" "email_direction" NOT NULL,
	"end_user_id" integer,
	"bot_id" integer,
	"user_id" integer,
	"subject" varchar(1024),
	"body_text" text,
	"body_html" text,
	"external_email_id" varchar(255),
	"message_id" varchar(512),
	"in_reply_to" varchar(512),
	"reference_ids" text[],
	"from" varchar(512),
	"to" text[],
	"forwarded_to" varchar(512),
	"reply_to" varchar(512),
	"status" "email_status" DEFAULT 'received' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "emails_external_email_id_unique" UNIQUE("external_email_id"),
	CONSTRAINT "exactly_one_sender" CHECK ((
      (CASE WHEN "emails"."end_user_id" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "emails"."bot_id" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "emails"."user_id" IS NOT NULL THEN 1 ELSE 0 END)
    ) = 1)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"email_id" integer NOT NULL,
	"external_attachment_id" varchar(255),
	"filename" varchar(512) NOT NULL,
	"content_type" varchar(255) NOT NULL,
	"size_bytes" integer,
	"storage_key" varchar(1024),
	"status" "attachment_status" DEFAULT 'pending' NOT NULL,
	"summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bot_tool_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" integer NOT NULL,
	"tool_call_id" varchar(255) NOT NULL,
	"tool_name" varchar(255) NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bot_tool_calls_tool_call_id_unique" UNIQUE("tool_call_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subdomains" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"subdomain" varchar(63) NOT NULL,
	"resend_domain_id" varchar(255),
	"status" "subdomain_status" DEFAULT 'not_started' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subdomains_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "users" ADD CONSTRAINT "users_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "bots" ADD CONSTRAINT "bots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "bots" ADD CONSTRAINT "bots_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "bot_settings" ADD CONSTRAINT "bot_settings_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "bot_settings" ADD CONSTRAINT "bot_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "bot_settings" ADD CONSTRAINT "bot_settings_voice_id_voices_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voices"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "bot_skills" ADD CONSTRAINT "bot_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "bot_skills" ADD CONSTRAINT "bot_skills_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "calendars" ADD CONSTRAINT "calendars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "calendars" ADD CONSTRAINT "calendars_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "calls" ADD CONSTRAINT "calls_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "calls" ADD CONSTRAINT "calls_from_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("from_phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "calls" ADD CONSTRAINT "calls_to_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("to_phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "call_settings" ADD CONSTRAINT "call_settings_forwarded_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("forwarded_phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "call_settings" ADD CONSTRAINT "call_settings_company_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("company_phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "call_settings" ADD CONSTRAINT "call_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "end_users" ADD CONSTRAINT "end_users_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "end_users" ADD CONSTRAINT "end_users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "faqs" ADD CONSTRAINT "faqs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "offerings" ADD CONSTRAINT "offerings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "call_transcripts" ADD CONSTRAINT "call_transcripts_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "call_transcript_entries" ADD CONSTRAINT "call_transcript_entries_transcript_id_call_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."call_transcripts"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "call_transcript_entries" ADD CONSTRAINT "call_transcript_entries_end_user_id_end_users_id_fk" FOREIGN KEY ("end_user_id") REFERENCES "public"."end_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "call_transcript_entries" ADD CONSTRAINT "call_transcript_entries_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "call_transcript_entries" ADD CONSTRAINT "call_transcript_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_from_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("from_phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_to_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("to_phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "email_addresses" ADD CONSTRAINT "email_addresses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "chats" ADD CONSTRAINT "chats_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "chats" ADD CONSTRAINT "chats_end_user_id_end_users_id_fk" FOREIGN KEY ("end_user_id") REFERENCES "public"."end_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "chats" ADD CONSTRAINT "chats_email_address_id_email_addresses_id_fk" FOREIGN KEY ("email_address_id") REFERENCES "public"."email_addresses"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "emails" ADD CONSTRAINT "emails_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "emails" ADD CONSTRAINT "emails_end_user_id_end_users_id_fk" FOREIGN KEY ("end_user_id") REFERENCES "public"."end_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "emails" ADD CONSTRAINT "emails_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "emails" ADD CONSTRAINT "emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "attachments" ADD CONSTRAINT "attachments_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "bot_tool_calls" ADD CONSTRAINT "bot_tool_calls_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "subdomains" ADD CONSTRAINT "subdomains_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
