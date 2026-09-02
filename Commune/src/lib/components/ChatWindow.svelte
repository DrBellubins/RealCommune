<script lang="ts">
	import { onDestroy } from 'svelte';
	import type maplibregl from 'maplibre-gl';

	import type { ChatMessage } from '$lib/data/chat';
	import type { MapUser } from '$lib/data/fakeUsers';

	import { clickOutside } from '$lib/actions/ClickOutside';

	let {
		map,
		client,
		contact,
		messages,
		onClose,
		onSend,
		onGeometryChange
	} = $props<{
		map: maplibregl.Map | null;
		client: MapUser;
		contact: MapUser | null;
		messages: ChatMessage[];
		onClose: () => void;
		onSend: (text: string) => void;
		onGeometryChange?: (geometry: {
			contactId: string;
			version: number;
			center: { x: number; y: number };
			size: { width: number; height: number };
		} | null) => void;
	}>();

	let draft = $state('');
	let position = $state({ x: 0, y: 0 });
	let chatWindowElement = $state<HTMLElement | null>(null);
	let geometryReportFrameId: ReturnType<typeof requestAnimationFrame> | null = null;
	let geometryVersion = 0;

	function reportGeometry()
	{
		if (!map || !contact || !chatWindowElement)
		{
			onGeometryChange?.(null);
			return;
		}

		const mapRect = map.getContainer().getBoundingClientRect();
		const chatRect = chatWindowElement.getBoundingClientRect();

		geometryVersion += 1;

		onGeometryChange?.(
		{
			contactId: contact.id,
			version: geometryVersion,
			center: {
				x: chatRect.left - mapRect.left + chatRect.width / 2,
				y: chatRect.top - mapRect.top + chatRect.height / 2
			},
			size: {
				width: chatRect.width,
				height: chatRect.height
			}
		});
	}

	function queueGeometryReport()
	{
		if (typeof window === 'undefined')
			return;

		if (geometryReportFrameId !== null)
			cancelAnimationFrame(geometryReportFrameId);

		geometryReportFrameId = requestAnimationFrame(() =>
		{
			geometryReportFrameId = null;
			reportGeometry();
		});
	}

	function updatePosition()
	{
		if (!map || !contact)
		{
			onGeometryChange?.(null);
			return;
		}

		const point = map.project([contact.longitude, contact.latitude]);

		position =
		{
			x: point.x,
			y: point.y
		};

		queueGeometryReport();
	}

	function handleSubmit()
	{
		const text = draft.trim();

		if (!text)
			return;

		onSend(text);
		draft = '';
	}

	$effect(() =>
	{
		if (!map || !contact)
		{
			onGeometryChange?.(null);
			return;
		}

		const events: Array<keyof maplibregl.MapEventType> =
		[
			'move',
			'zoom',
			'rotate',
			'pitch',
			'resize'
		];

		updatePosition();

		for (const eventName of events)
			map.on(eventName, updatePosition);

		return () =>
		{
			for (const eventName of events)
				map.off(eventName, updatePosition);
		};
	});

	$effect(() =>
	{
		if (!chatWindowElement || !contact)
			return;

		const observer = new ResizeObserver(() =>
		{
			queueGeometryReport();
		});

		observer.observe(chatWindowElement);
		queueGeometryReport();

		return () =>
		{
			observer.disconnect();
		};
	});

	onDestroy(() =>
	{
		if (geometryReportFrameId !== null)
			cancelAnimationFrame(geometryReportFrameId);

		onGeometryChange?.(null);
		draft = '';
	});
</script>

{#if contact}
<div use:clickOutside={() => (contact = null)}>
	<section
		bind:this={chatWindowElement}
		class="chat-window"
		aria-label={`Chat with ${contact.name}`}
		style={`left: ${position.x}px; top: ${position.y}px;`}
	>
		<header>
			<div>
				<p class="eyebrow">Direct message</p>
				<h2>{contact.name}</h2>
			</div>

			<button
				type="button"
				class="close-button"
				onclick={onClose}
				aria-label={`Close chat with ${contact.name}`}
			>
				×
			</button>
		</header>

		<div class="messages" aria-live="polite">
			{#if messages.length === 0}
				<p class="empty-message">Start your conversation with {contact.name}.</p>
			{:else}
				{#each messages as message (message.id)}
					<div
						class:from-client={message.senderId === client.id}
						class:from-contact={message.senderId !== client.id}
						class="message-row"
					>
						<p class="bubble">{message.text}</p>
						<span>{message.sentAt}</span>
					</div>
				{/each}
			{/if}
		</div>

		<form onsubmit={(event) =>
		{
			event.preventDefault();
			handleSubmit();
		}}>
			<label class="sr-only" for="message">
				Message {contact.name}
			</label>

			<input
				id="message"
				bind:value={draft}
				placeholder={`Message ${contact.name}`}
				autocomplete="off"
			/>

			<button type="submit">Send</button>
		</form>
	</section>
</div>
{/if}

<style>
	.chat-window
	{
		position: absolute;
		z-index: 10;
		width: min(22rem, calc(100% - 2rem));
		max-height: 30rem;
		display: grid;
		grid-template-rows: auto minmax(8rem, 1fr) auto;
		overflow: hidden;
		border: 1px solid rgba(18, 28, 44, 0.18);
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.97);
		box-shadow: 0 1rem 3rem rgba(10, 29, 56, 0.28);
		transform: translate(-50%, calc(-100% - 1.25rem));
		backdrop-filter: blur(12px);
	}

	.chat-window::after
	{
		position: absolute;
		bottom: -0.55rem;
		left: 50%;
		width: 1rem;
		height: 1rem;
		background: rgba(255, 255, 255, 0.97);
		content: '';
		transform: translateX(-50%) rotate(45deg);
	}

	header
	{
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem 1rem;
		border-bottom: 1px solid rgba(18, 28, 44, 0.1);
	}

	.eyebrow
	{
		margin: 0 0 0.2rem;
		color: #63738a;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	h2
	{
		margin: 0;
		color: #14233a;
		font-size: 1rem;
	}

	.close-button
	{
		border: 0;
		background: transparent;
		color: #526178;
		cursor: pointer;
		font-size: 1.5rem;
		line-height: 1;
	}

	.messages
	{
		display: grid;
		align-content: start;
		gap: 0.65rem;
		max-height: 16rem;
		padding: 0.85rem;
		overflow-y: auto;
	}

	.message-row
	{
		display: grid;
		gap: 0.15rem;
		max-width: 82%;
	}

	.message-row.from-client
	{
		justify-self: end;
		text-align: right;
	}

	.message-row.from-contact
	{
		justify-self: start;
		text-align: left;
	}

	.bubble
	{
		margin: 0;
		padding: 0.65rem 0.8rem;
		border-radius: 0.9rem;
		line-height: 1.35;
	}

	.from-contact .bubble
	{
		border-bottom-left-radius: 0.2rem;
		background: #1688ff;
		color: white;
	}

	.from-client .bubble
	{
		border-bottom-right-radius: 0.2rem;
		background: #d8dee8;
		color: #172235;
	}

	.message-row span
	{
		color: #76859a;
		font-size: 0.68rem;
	}

	.empty-message
	{
		margin: 0;
		color: #687990;
		font-size: 0.9rem;
		text-align: center;
	}

	form
	{
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem;
		padding: 0.75rem;
		border-top: 1px solid rgba(18, 28, 44, 0.1);
	}

	input
	{
		min-width: 0;
		padding: 0.65rem 0.75rem;
		border: 1px solid #c6d0df;
		border-radius: 0.65rem;
		color: #172235;
		font: inherit;
	}

    input:focus
    {
	    outline: 2px solid #009edd;
	    outline-offset: 2px;
    }

	form button
	{
		padding: 0.65rem 0.8rem;
		border: 0;
		border-radius: 0.65rem;
		background: #1688ff;
		color: white;
		cursor: pointer;
		font: inherit;
		font-weight: 700;
	}

	.sr-only
	{
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (max-width: 40rem)
	{
		.chat-window
		{
			width: min(20rem, calc(100% - 1rem));
		}
	}
</style>