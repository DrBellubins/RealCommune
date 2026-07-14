import { json } from '@sveltejs/kit';
import type { RequestHandler } from '../$types';
import { loadConversation, saveMessage } from '$lib/server/db/ChatDB';

export const GET: RequestHandler = async ({ url }) => {
	const conversationId = url.searchParams.get('conversationId');
	if (!conversationId) {
		return json({ error: 'conversationId is required' }, { status: 400 });
	}

	const messages = await loadConversation(conversationId);
	return json(messages);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	await saveMessage(body);
	return json({ ok: true });
};
