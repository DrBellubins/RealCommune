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

	function renderMarkers(currentMap: maplibregl.Map | null, currentUsers: MapUser[])
	{
		clearMarkers();

		if (!currentMap)
		{
			return;
		}

		for (const user of currentUsers)
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
				.addTo(currentMap);

			markers.push(marker);
		}
	}

	$effect(() =>
	{
		renderMarkers(map, users);
	});

	onDestroy(() =>
	{
		clearMarkers();
	});
</script>