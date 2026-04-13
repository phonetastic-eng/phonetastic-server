import type { ConnectedCall } from './call.js';
import type { Bot } from './bot.js';
import type { Voice } from './voice.js';
import type { EndUser } from './end-user.js';
import type { Company } from './company.js';

export type CallContext = {
  call: ConnectedCall;
  bot: Bot;
  voice: Voice;
  endUser: EndUser | null;
  company: Company;
};
