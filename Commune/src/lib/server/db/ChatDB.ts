import { eq, asc } from 'drizzle-orm';
import { db } from './index';
import { chatMessage } from './schema';
import type { ChatMessage } from '$lib/data/chat';

/**
 * Load all messages for a single conversation (user pair).
 */
export async function loadConversation(
	conversationId: string
): Promise<ChatMessage[]>
{
	const rows = await db
		.select()
		.from(chatMessage)
		.where(eq(chatMessage.conversationId, conversationId))
		.orderBy(asc(chatMessage.sentAt));

	return rows.map((row) => 
	({
		id: row.id,
		senderId: row.senderId,
		recipientId: row.recipientId,
		text: row.text,
		sentAt: row.sentAt
	}));
}

/**
 * Persist a single outgoing message.
 */
export async function saveMessage(payload:
{
	id: string;
	conversationId: string;
	senderId: string;
	recipientId: string;
	text: string;
	sentAt: string;
}): Promise<void>
{
	await db.insert(chatMessage).values(
	{
		id: payload.id,
		conversationId: payload.conversationId,
		senderId: payload.senderId,
		recipientId: payload.recipientId,
		text: payload.text,
		sentAt: payload.sentAt
	});
}