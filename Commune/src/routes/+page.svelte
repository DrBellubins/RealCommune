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

	/*function handleChatWindowGeometryChange(geometry: ChatWindowGeometry | null)
	{
		chatWindowGeometry = geometry;
	}*/

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
				// If the component updates out from under this queued recenter,
				// dropping the pending request is safer than forcing a stale pan.
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

		<ChatWindow
			{map}
			client={testClient}
			contact={selectedUser}
			messages={selectedMessages}
			//onGeometryChange={handleChatWindowGeometryChange}
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
</style>
