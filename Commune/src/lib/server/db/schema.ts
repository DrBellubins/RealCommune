import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth.schema';

export const task = sqliteTable('task',
{
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

/* ── Chat messages ─────────────────────────────────────────────── */

export const chatMessage = sqliteTable('chatMessage',
{
	id:         text('id').primaryKey(),
	conversationId: text('conversation_id').notNull(),   // e.g. "ada-marin:test-client"
	senderId:   text('sender_id').notNull(),
	recipientId: text('recipient_id').notNull(),
	text:       text('text').notNull(),
	sentAt:     text('sent_at').notNull()
});

export * from './auth.schema';

export const userProfile = sqliteTable('userProfile',
{
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	role: text('role').notNull().default('member'),
	isEventOrganizer: integer('is_event_organizer').notNull().default(0)
});