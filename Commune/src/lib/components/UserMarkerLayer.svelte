<script lang="ts">
	import { onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';

	import type { MapUser } from '$lib/data/fakeUsers';

	let {
		map,
		users,
		onUserSelect
	} = $props<{
		map: maplibregl.Map | null;
		users: MapUser[];
		onUserSelect: (user: MapUser) => void;
	}>();

	let markers: maplibregl.Marker[] = [];

	function clearMarkers()
	{
		for (const marker of markers)
		{
			marker.remove();
		}

		markers = [];
	}

	function renderMarkers()
	{
		if (!map)
		{
			return;
		}

		clearMarkers();

		for (const user of users)
		{
			const element = document.createElement('button');

			element.type = 'button';
			element.className = 'user-dot';
			element.title = `Message ${user.name}`;
			element.setAttribute('aria-label', `Open chat with ${user.name}`);

			element.addEventListener('pointerdown', (event) =>
			{
				event.stopPropagation();
			});

			element.addEventListener('click', (event) =>
			{
				event.stopPropagation();
				onUserSelect(user);
			});

			const marker = new maplibregl.Marker({
				element,
				anchor: 'center'
			})
				.setLngLat([user.longitude, user.latitude])
				.addTo(map);

			markers.push(marker);
		}
	}

	$effect(() =>
	{
		map;
		users;
		renderMarkers();
	});

	onDestroy(() =>
	{
		clearMarkers();
	});
</script>

<style>
	:global(.user-dot)
	{
		width: 18px;
		height: 18px;
		padding: 0;
		border: 2px solid rgba(255, 255, 255, 0.95);
		border-radius: 50%;
		background: radial-gradient(circle at 30% 30%, #9fe0ff, #2e7bff);
		box-shadow: 0 0 0 8px rgba(72, 145, 255, 0.2);
		cursor: pointer;
	}

	:global(.user-dot:hover),
	:global(.user-dot:focus-visible)
	{
		transform: scale(1.12);
		outline: none;
	}
</style>