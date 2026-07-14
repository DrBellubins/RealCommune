import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const task = sqliteTable('task', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

/* ── Chat messages ─────────────────────────────────────────────── */

export const chatMessage = sqliteTable('chatMessage', {
	id:         text('id').primaryKey(),
	conversationId: text('conversation_id').notNull(),   // e.g. "ada-marin:test-client"
	senderId:   text('sender_id').notNull(),
	recipientId: text('recipient_id').notNull(),
	text:       text('text').notNull(),
	sentAt:     text('sent_at').notNull()
});

export * from './auth.schema';