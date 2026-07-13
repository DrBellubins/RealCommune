export type ChatMessage = {
	id: string;
	senderId: string;
	recipientId: string;
	text: string;
	sentAt: string;
};

export type ConversationMessages = Record<string, ChatMessage[]>;

export function getConversationId(firstUserId: string, secondUserId: string): string
{
	return [firstUserId, secondUserId].sort().join(':');
}

export const initialConversations: ConversationMessages = {
	'ada-marin:test-client': [
		{
			id: 'ada-1',
			senderId: 'ada-marin',
			recipientId: 'test-client',
			text: 'Hi TestClient — are you joining the walk later?',
			sentAt: '10:03'
		},
		{
			id: 'client-1',
			senderId: 'test-client',
			recipientId: 'ada-marin',
			text: 'Yes, I should be there in a few minutes.',
			sentAt: '10:04'
		}
	],
	'noah-rossi:test-client': [
		{
			id: 'noah-1',
			senderId: 'noah-rossi',
			recipientId: 'test-client',
			text: 'Want to review the map interaction idea?',
			sentAt: '10:10'
		}
	]
};