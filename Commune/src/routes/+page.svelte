<script lang="ts">
	import { tick } from 'svelte';
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

	const CHAT_CENTER_DURATION_MS = 700;

	type ChatWindowGeometry = {
		contactId: string;
		version: number;
		center: {
			x: number;
			y: number;
		};
		size: {
			width: number;
			height: number;
		};
	};

	let map = $state<maplibregl.Map | null>(null);
	let selectedUser = $state<MapUser | null>(null);
	let conversations = $state<ConversationMessages>(initialConversations);
	let chatWindowGeometry = $state<ChatWindowGeometry | null>(null);
	let centerChatRequest = $state(0);
	let requestedGeometryVersion = $state(0);

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

	function queueChatCentering(requireFreshGeometry = false)
	{
		const currentGeometryVersion = getSelectedUserGeometryVersion();

		requestedGeometryVersion = requireFreshGeometry
			? currentGeometryVersion + 1
			: currentGeometryVersion;

		centerChatRequest += 1;
	}

	function centerOnChatWindow()
	{
		if (!map || !selectedUser || !chatWindowGeometry)
		{
			return;
		}

		map.easeTo({
			center: map.unproject([
				chatWindowGeometry.center.x,
				chatWindowGeometry.center.y
			]),
			duration: CHAT_CENTER_DURATION_MS,
			easing: (t) => t * (2 - t)
		});
	}

	function handleChatWindowGeometryChange(geometry: ChatWindowGeometry | null)
	{
		chatWindowGeometry = geometry;
	}

	function getSelectedUserGeometryVersion()
	{
		if (!selectedUser || !chatWindowGeometry)
		{
			return 0;
		}

		if (chatWindowGeometry.contactId !== selectedUser.id)
		{
			return 0;
		}

		return chatWindowGeometry.version;
	}

	function canCenterSelectedChat()
	{
		return Boolean(
			centerChatRequest &&
			selectedUser &&
			chatWindowGeometry &&
			chatWindowGeometry.contactId === selectedUser.id &&
			chatWindowGeometry.version >= requestedGeometryVersion
		);
	}

	function handleUserSelect(user: MapUser)
	{
		const isSameUser = selectedUser?.id === user.id;

		selectedUser = user;
		queueChatCentering(!isSameUser);
	}

	function closeChat()
	{
		selectedUser = null;
		chatWindowGeometry = null;
		centerChatRequest = 0;
		requestedGeometryVersion = 0;
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

	$effect(() =>
	{
		if (!map || !selectedUser)
		{
			return;
		}

		const currentMap = map;

		const handleResize = () =>
		{
			queueChatCentering(true);
		};

		currentMap.on('resize', handleResize);

		return () =>
		{
			currentMap.off('resize', handleResize);
		};
	});

	$effect(() =>
	{
		if (!canCenterSelectedChat())
		{
			return;
		}

		const requestId = centerChatRequest;

		(async () =>
		{
			try
			{
				await tick();
			}
			catch
			{
				return;
			}

			if (centerChatRequest !== requestId || !canCenterSelectedChat())
			{
				return;
			}

			centerChatRequest = 0;
			centerOnChatWindow();
		})();
	});
</script>

<svelte:head>
	<title>Commune map prototype</title>
	<meta
		name="description"
		content="A map prototype with fake user locations and direct-message conversations."
	/>
</svelte:head>

<section class="page">
	<div class="map-shell">
		<MapView onMapReady={handleMapReady} />

		<UserMarkerLayer
			{map}
			users={fakeUsers}
			onUserSelect={handleUserSelect}
		/>

		<div class="overlay-panel">
			<header class="hero">
				<p class="eyebrow">Demo surface</p>
				<h1>Map messaging prototype</h1>
				<p>
					Select a user dot to start a direct message conversation as TestClient. The chat
					window stays anchored above the selected user on the map.
				</p>
			</header>

			<nav class="friend-list" aria-label="Friends">
				{#each fakeUsers as user (user.id)}
					<button
						type="button"
						class:selected={selectedUser?.id === user.id}
						onclick={() => handleUserSelect(user)}
					>
						<span>{user.name}</span>
						<small>{user.locationLabel}</small>
					</button>
				{/each}
			</nav>
		</div>

		<ChatWindow
			{map}
			client={testClient}
			contact={selectedUser}
			messages={selectedMessages}
			onGeometryChange={handleChatWindowGeometryChange}
			onClose={closeChat}
			onSend={sendMessage}
		/>
	</div>
</section>

<style>
	:global(html, body)
	{
		height: 100%;
		margin: 0;
	}

	:global(body)
	{
		overflow: hidden;
		background: #09111d;
	}

	.page
	{
		width: 100vw;
		height: 100vh;
	}

	@supports (height: 100dvh)
	{
		.page
		{
			height: 100dvh;
		}
	}

	.map-shell
	{
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.overlay-panel
	{
		position: absolute;
		top: 1rem;
		left: 1rem;
		z-index: 20;
		display: grid;
		gap: 0.75rem;
		width: min(22rem, calc(100vw - 2rem));
	}

	.hero
	{
		padding: 1rem 1rem 1.1rem;
		border: 1px solid rgba(167, 197, 255, 0.2);
		border-radius: 1rem;
		background: rgba(9, 17, 29, 0.72);
		color: #edf4ff;
		backdrop-filter: blur(16px);
	}

	.eyebrow
	{
		margin: 0 0 0.35rem;
		color: #8db7ff;
		font-size: 0.74rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	h1
	{
		margin: 0;
		font-size: clamp(1.8rem, 4vw, 2.8rem);
		line-height: 0.95;
	}

	.hero p:not(.eyebrow)
	{
		max-width: 32ch;
		margin: 0.8rem 0 0;
		color: rgba(237, 244, 255, 0.86);
	}

	.friend-list
	{
		display: grid;
		gap: 0.5rem;
	}

	.friend-list button
	{
		display: grid;
		gap: 0.1rem;
		padding: 0.75rem 0.9rem;
		border: 1px solid rgba(167, 197, 255, 0.18);
		border-radius: 0.9rem;
		background: rgba(9, 17, 29, 0.62);
		color: #edf4ff;
		cursor: pointer;
		font: inherit;
		text-align: left;
		backdrop-filter: blur(16px);
	}

	.friend-list button.selected
	{
		border-color: rgba(107, 173, 255, 0.95);
		background: rgba(22, 136, 255, 0.3);
	}

	.friend-list button small
	{
		color: rgba(188, 208, 239, 0.88);
		font-size: 0.76rem;
	}

	@media (max-width: 40rem)
	{
		.overlay-panel
		{
			width: min(20rem, calc(100vw - 1rem));
			top: 0.5rem;
			left: 0.5rem;
		}

		.hero
		{
			padding: 0.85rem 0.9rem 1rem;
		}
	}
</style>
