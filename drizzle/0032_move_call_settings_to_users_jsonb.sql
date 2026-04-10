ALTER TABLE "users" ADD COLUMN "call_settings" jsonb NOT NULL DEFAULT '{}';

UPDATE "users"
SET "call_settings" = (
  SELECT jsonb_build_object(
    'forwardedPhoneNumberId', cs.forwarded_phone_number_id,
    'companyPhoneNumberId', cs.company_phone_number_id,
    'isBotEnabled', cs.is_bot_enabled,
    'ringsBeforeBotAnswer', cs.rings_before_bot_answer,
    'answerCallsFrom', cs.answer_calls_from::text,
    'sipDispatchRuleId', cs.sip_dispatch_rule_id
  )
  FROM "call_settings" cs
  WHERE cs.user_id = "users".id
)
WHERE EXISTS (SELECT 1 FROM "call_settings" cs WHERE cs.user_id = "users".id);

DROP TABLE "call_settings";

DROP TYPE IF EXISTS "answer_calls_from";
