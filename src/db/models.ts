import {
  addresses,
  appointmentBookingSettings,
  attachments,
  botSettings,
  botToolCalls,
  bots,
  calendars,
  callParticipants,
  callSettings,
  callTranscriptEntries,
  callTranscripts,
  calls,
  chats,
  companies,
  contactPhoneNumbers,
  contacts,
  emailAddresses,
  emails,
  endUsers,
  faqs,
  offerings,
  operationHours,
  phoneNumbers,
  skills,
  smsMessages,
  subdomains,
  users,
  voices,
} from './schema/index.js';

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;

export type AppointmentBookingSettings = typeof appointmentBookingSettings.$inferSelect;
export type NewAppointmentBookingSettings = typeof appointmentBookingSettings.$inferInsert;

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;

export type BotSettings = typeof botSettings.$inferSelect;
export type NewBotSettings = typeof botSettings.$inferInsert;

export type BotToolCall = typeof botToolCalls.$inferSelect;
export type NewBotToolCall = typeof botToolCalls.$inferInsert;

export type Bot = typeof bots.$inferSelect;
export type NewBot = typeof bots.$inferInsert;

export type Calendar = typeof calendars.$inferSelect;
export type NewCalendar = typeof calendars.$inferInsert;

export type CallParticipant = typeof callParticipants.$inferSelect;
export type NewCallParticipant = typeof callParticipants.$inferInsert;

export type CallSettings = typeof callSettings.$inferSelect;
export type NewCallSettings = typeof callSettings.$inferInsert;

export type CallTranscriptEntry = typeof callTranscriptEntries.$inferSelect;
export type NewCallTranscriptEntry = typeof callTranscriptEntries.$inferInsert;

export type CallTranscript = typeof callTranscripts.$inferSelect;
export type NewCallTranscript = typeof callTranscripts.$inferInsert;

export type Call = typeof calls.$inferSelect;
export type NewCall = typeof calls.$inferInsert;

export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

export type ContactPhoneNumber = typeof contactPhoneNumbers.$inferSelect;
export type NewContactPhoneNumber = typeof contactPhoneNumbers.$inferInsert;

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;

export type EmailAddress = typeof emailAddresses.$inferSelect;
export type NewEmailAddress = typeof emailAddresses.$inferInsert;

export type Email = typeof emails.$inferSelect;
export type NewEmail = typeof emails.$inferInsert;

export type EndUser = typeof endUsers.$inferSelect;
export type NewEndUser = typeof endUsers.$inferInsert;

export type Faq = typeof faqs.$inferSelect;
export type NewFaq = typeof faqs.$inferInsert;

export type Offering = typeof offerings.$inferSelect;
export type NewOffering = typeof offerings.$inferInsert;

export type OperationHours = typeof operationHours.$inferSelect;
export type NewOperationHours = typeof operationHours.$inferInsert;

export type PhoneNumber = typeof phoneNumbers.$inferSelect;
export type NewPhoneNumber = typeof phoneNumbers.$inferInsert;
export type BotWithPhoneNumber = Bot & { phoneNumber?: PhoneNumber };

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;

export type SmsMessage = typeof smsMessages.$inferSelect;
export type NewSmsMessage = typeof smsMessages.$inferInsert;

export type Subdomain = typeof subdomains.$inferSelect;
export type NewSubdomain = typeof subdomains.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Voice = typeof voices.$inferSelect;
export type NewVoice = typeof voices.$inferInsert;

export type EndUserParticipant = CallParticipant & { endUser: EndUser };
export type BotParticipant = CallParticipant & { voice: Voice | undefined; bot: Bot };
export type InboundCall = Call & {
  endUserParticipant: EndUserParticipant;
  botParticipant: BotParticipant;
  fromPhoneNumber: PhoneNumber;
  toPhoneNumber: PhoneNumber;
};
