import { pgTable, serial, varchar, text } from 'drizzle-orm/pg-core';

export const voices = pgTable('voices', {
  id: serial('id').primaryKey(),
  supportedLanguages: text('supported_languages').array().notNull().default(['en']),
  name: varchar('name', { length: 255 }).notNull(),
  snippet: varchar('snippet', { length: 65535 }).notNull(),
  snippetMimeType: varchar('snippet_mime_type', { length: 255 }).notNull(),
});
