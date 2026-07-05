<script lang="ts">
	import MapView from '$lib/components/MapView.svelte';
	import UserPopup from '$lib/components/UserPopup.svelte';
	import { fakeUsers, type FakeUser } from '$lib/data/fakeUsers';

	let selectedUser = $state<FakeUser | null>(null);

	function handleUserSelect(user: FakeUser) {
		selectedUser = user;
	}

	function closePopup() {
		selectedUser = null;
	}
</script>

<svelte:head>
	<title>Commune map prototype</title>
	<meta
		name="description"
		content="Interactive map prototype with fake users and popup contact cards."
	/>
</svelte:head>

<section class="page">
	<header class="hero">
		<p class="eyebrow">Demo surface</p>
		<h1>Interactable map skeleton</h1>
		<p>
			Fixed user dots are rendered from local prototype data. Clicking a dot opens a simple
			profile popup as the first step toward messaging.
		</p>
	</header>

	<MapView users={fakeUsers} onUserSelect={handleUserSelect} />
	<UserPopup user={selectedUser} onClose={closePopup} />
</section>

<style>
	.page {
		display: grid;
		gap: 1rem;
		padding: 1.25rem;
	}

	.hero {
		max-width: 42rem;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		text-transform: uppercase;
		letter-spacing: 0.16em;
		font-size: 0.74rem;
		color: #5d7ea8;
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3.3rem);
		line-height: 1;
	}

	p {
		margin: 0.8rem 0 0;
		color: #4a5e78;
		max-width: 60ch;
	}
</style>
