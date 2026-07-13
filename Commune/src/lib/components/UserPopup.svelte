<script lang="ts">
	import type { FakeUser } from '$lib/data/fakeUsers';

	type Message = {
		id: string;
		senderId: string;
		text: string;
		timestamp: Date;
	};

	let {
		user,
		onClose
	} = $props<{
		user: FakeUser | null;
		onClose: () => void;
	}>();

	let messages = $state<Message[]>([
		{ id: '1', senderId: 'other', text: 'Hey there!', timestamp: new Date() },
		{ id: '2', senderId: 'me', text: 'Hi! How are you?', timestamp: new Date() }
	]);
	let newMessage = $state('');
	let showChat = $state(false);
	const myId = 'me';

	function sendMessage() {
		if (!newMessage.trim()) return;
		messages = [...messages, {
			id: crypto.randomUUID(),
			senderId: myId,
			text: newMessage,
			timestamp: new Date()
		}];
		newMessage = '';
		// Auto scroll to bottom (simulated by Svelte's reactivity if we had a ref, 
		// but for now we'll just rely on the DOM)
	}
</script>

{#if user}
	<div class="overlay">
		<div class="popup" role="dialog" aria-modal="true" aria-label={`Profile for ${user.name}`}>
			<div class="header">
				<div>
					<p class="eyebrow">User dot</p>
					<h2>{user.name}</h2>
				</div>
				<button type="button" class="close" onclick={onClose} aria-label="Close profile">
					×
				</button>
			</div>

			<p class="role">{user.role} • {user.status}</p>
			<p class="preview">{user.preview}</p>

			<dl>
				<div>
					<dt>Location</dt>
					<dd>{user.locationLabel}</dd>
				</div>
				<div>
					<dt>Coordinates</dt>
					<dd>{user.latitude.toFixed(4)}, {user.longitude.toFixed(4)}</dd>
				</div>
			</dl>

			<div class="actions">
				<button type="button" class="primary" onclick={() => showChat = !showChat}>
					{showChat ? 'Close Chat' : 'Chat'}
				</button>
				<button type="button" class="secondary" onclick={onClose}>
					Dismiss
				</button>
			</div>

			{#if showChat}
				<div class="chat-container">
					<div class="messages-list">
						{#each messages as msg}
							<div class="message {msg.senderId === myId ? 'me' : 'other'}">
								<div class="bubble">{msg.text}</div>
							</div>
						{/each}
					</div>
					<form class="input-area" onsubmit={(e) => { e.preventDefault(); sendMessage(); }}>
						<input type="text" bind:value={newMessage} placeholder="Type a message..." />
						<button type="submit">Send</button>
					</form>
				</div>
			{/if}
		</div>
	</div>
	{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1.5rem;
		background: rgba(7, 10, 16, 0.45);
		backdrop-filter: blur(10px);
		z-index: 20;
	}

	.popup {
		width: min(92vw, 26rem);
		border-radius: 1.25rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: linear-gradient(180deg, rgba(18, 24, 38, 0.96), rgba(13, 18, 30, 0.98));
		color: #f5f7fb;
		padding: 1.25rem;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
	}

	.header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 1rem;
	}

	.eyebrow {
		margin: 0 0 0.25rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		font-size: 0.72rem;
		color: rgba(165, 182, 214, 0.8);
	}

	h2 {
		margin: 0;
		font-size: 1.4rem;
	}

	.close,
	.primary,
	.secondary {
		font: inherit;
	}

	.close {
		border: 0;
		background: transparent;
		color: inherit;
		font-size: 1.6rem;
		line-height: 1;
		padding: 0.1rem 0.25rem;
		cursor: pointer;
	}

	.role {
		margin: 0.5rem 0 0;
		color: #8fc8ff;
	}

	.preview {
		margin: 0.9rem 0 1rem;
		color: rgba(233, 238, 247, 0.9);
	}

	dl {
		margin: 0;
		display: grid;
		gap: 0.8rem;
	}

	dl div {
		padding: 0.75rem 0.85rem;
		border-radius: 0.9rem;
		background: rgba(255, 255, 255, 0.04);
	}

	dt {
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(165, 182, 214, 0.78);
	}

	dd {
		margin: 0.3rem 0 0;
		color: #fff;
	}

	.actions {
		display: flex;
		gap: 0.75rem;
		margin-top: 1rem;
		flex-wrap: wrap;
	}

	.primary,
	.secondary {
		border-radius: 999px;
		padding: 0.75rem 1rem;
		border: 1px solid transparent;
	}

	.primary {
		background: linear-gradient(135deg, #7bc3ff, #5e8df2);
		color: #07101f;
		font-weight: 700;
	}

	.primary:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.secondary {
		background: transparent;
		color: #fff;
		border-color: rgba(255, 255, 255, 0.14);
	}
</style>