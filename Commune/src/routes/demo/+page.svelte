<script lang="ts">
	import type maplibregl from 'maplibre-gl';

	import ChatWindow from '$lib/components/ChatWindow.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import UserMarkerLayer from '$lib/components/UserMarkerLayer.svelte';
	import {
		getConversationId,
		initialConversations,
		type ChatMessage,
		type ConversationMessages
	} from '$lib/data/chat';
	import { fakeUsers, testClient, type MapUser } from '$lib/data/fakeUsers';

	// Pixel offset applied when centering on a selected user, so the chat
	// window (which is anchored above the marker) ends up centered in view
	// instead of the marker itself.
	const CHAT_CENTER_OFFSET: [number, number] = [0, -160];
	const CHAT_CENTER_DURATION_MS = 700;

	let map = $state<maplibregl.Map | null>(null);
	let selectedUser = $state<MapUser | null>(null);
	let conversations = $state<ConversationMessages>(initialConversations);

	let selectedMessages = $derived.by(() =>
	{
		if (!selectedUser)
		{
			return [];
		}

		const conversationId = getConversationId(testClient.id, selectedUser.id);

		return conversations[conversationId] ?? [];
	});

	function handleMapReady(readyMap: maplibregl.Map)
	{
		map = readyMap;
	}

	function centerOnUser(user: MapUser)
	{
		if (!map)
		{
			return;
		}

		map.easeTo({
			center: [user.longitude, user.latitude],
			offset: CHAT_CENTER_OFFSET,
			duration: CHAT_CENTER_DURATION_MS,
			easing: (t) => t * (2 - t)
		});
	}

	function handleUserSelect(user: MapUser)
	{
		selectedUser = user;
		centerOnUser(user);
	}

	function closeChat()
	{
		selectedUser = null;
	}

	function sendMessage(text: string)
	{
		if (!selectedUser)
		{
			return;
		}

		const conversationId = getConversationId(testClient.id, selectedUser.id);

		const message: ChatMessage = {
			id: crypto.randomUUID(),
			senderId: testClient.id,
			recipientId: selectedUser.id,
			text,
			sentAt: new Intl.DateTimeFormat('en', {
				hour: 'numeric',
				minute: '2-digit'
			}).format(new Date())
		};

		conversations = {
			...conversations,
			[conversationId]: [...(conversations[conversationId] ?? []), message]
		};
	}
</script>

<svelte:head>
	<title>Commune map prototype</title>
	<meta
		name="description"
		content="A map prototype with fake user locations and direct-message conversations."
	/>
</svelte:head>

<section class="page">
	<header class="hero">
		<p class="eyebrow">Demo surface</p>
		<h1>Map messaging prototype</h1>
		<p>
			Select a user dot to start a direct message conversation as TestClient. The chat window
			stays anchored above the selected user on the map.
		</p>
	</header>

	<div class="map-shell">
		<MapView onMapReady={handleMapReady} />

		<UserMarkerLayer
			{map}
			users={fakeUsers}
			onUserSelect={handleUserSelect}
		/>

		<ChatWindow
			{map}
			client={testClient}
			contact={selectedUser}
			messages={selectedMessages}
			onClose={closeChat}
			onSend={sendMessage}
		/>
	</div>
</section>

<style>
	.page
	{
		display: grid;
		gap: 1rem;
		padding: 1.25rem;
	}

	.hero
	{
		max-width: 42rem;
	}

	.eyebrow
	{
		margin: 0 0 0.35rem;
		color: #5d7ea8;
		font-size: 0.74rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	h1
	{
		margin: 0;
		font-size: clamp(2rem, 5vw, 3.3rem);
		line-height: 1;
	}

	.hero p:not(.eyebrow)
	{
		max-width: 60ch;
		margin: 0.8rem 0 0;
		color: #4a5e78;
	}

	.map-shell
	{
		position: relative;
		width: 100%;
		height: min(72vh, 44rem);
		overflow: hidden;
		border-radius: 12px;
	}
</style>
