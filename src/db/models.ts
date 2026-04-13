import {
  addresses,
  attachments,
  botToolCalls,
  bots,
  calendars,
  callParticipants,
  callTranscriptEntries,
  callTranscripts,
  calls,
  chats,
  companies,
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

export type NewAddress = typeof addresses.$inferInsert;
export type NewAttachment = typeof attachments.$inferInsert;
export type NewBotToolCall = typeof botToolCalls.$inferInsert;
export type NewBot = typeof bots.$inferInsert;
export type NewCalendar = typeof calendars.$inferInsert;
export type NewCallParticipant = typeof callParticipants.$inferInsert;
export type NewCallTranscriptEntry = typeof callTranscriptEntries.$inferInsert;
export type NewCallTranscript = typeof callTranscripts.$inferInsert;
export type NewCall = typeof calls.$inferInsert;
export type NewChat = typeof chats.$inferInsert;
export type NewCompany = typeof companies.$inferInsert;
export type NewContact = typeof contacts.$inferInsert;
export type NewEmailAddress = typeof emailAddresses.$inferInsert;
export type NewEmail = typeof emails.$inferInsert;
export type NewEndUser = typeof endUsers.$inferInsert;
export type NewFaq = typeof faqs.$inferInsert;
export type NewOffering = typeof offerings.$inferInsert;
export type NewOperationHours = typeof operationHours.$inferInsert;
export type NewPhoneNumber = typeof phoneNumbers.$inferInsert;
export type NewSkill = typeof skills.$inferInsert;
export type NewSmsMessage = typeof smsMessages.$inferInsert;
export type NewSubdomain = typeof subdomains.$inferInsert;
export type NewUser = typeof users.$inferInsert;
export type NewVoice = typeof voices.$inferInsert;

export type {
  Address,
  Attachment,
  PendingAttachment,
  StoredAttachment,
  FailedAttachment,
  Bot,
  BotToolCall,
  Calendar,
  Call,
  CallParticipant,
  AgentCallParticipant,
  BotCallParticipant,
  EndUserCallParticipant,
  CallTranscript,
  CallTranscriptEntry,
  Chat,
  Company,
  Contact,
  Email,
  EmailAddress,
  EndUser,
  Faq,
  Offering,
  OperationHours,
  PhoneNumber,
  Skill,
  SmsMessage,
  Subdomain,
  User,
  Voice,
  BotParticipant,
  EndUserParticipant,
  AgentParticipant,
  InboundConnectedLiveCallWithParticipants,
  InboundConnectedTestCallWithParticipants,
  InboundConnectedCallWithParticipants,
  ConnectedCall,
  InboundConnectedCall,
  WaitingInboundCall,
  ConnectingInboundCall,
  WaitingAgentParticipant,
  ConnectingAgentParticipant,
  CallContext,
} from '../types/index.js';
