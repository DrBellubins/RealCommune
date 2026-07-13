<script lang="ts">
	import { onMount } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import type { StyleSpecification } from 'maplibre-gl';

	import styleJson from './style.json';
	import 'maplibre-gl/dist/maplibre-gl.css';

	let {
		onMapReady
	} = $props<{
		onMapReady: (map: maplibregl.Map) => void;
	}>();

	let container: HTMLDivElement;
	let map: maplibregl.Map | undefined;

	onMount(() =>
	{
		map = new maplibregl.Map({
			container,
			style: styleJson as unknown as StyleSpecification,
			center: [0, 0],
			zoom: 2
		});

		map.on('load', () =>
		{
			if (map)
			{
				onMapReady(map);
			}
		});

		return () =>
		{
			map?.remove();
		};
	});
</script>

<div bind:this={container} class="map"></div>

<style>
	.map
	{
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border-radius: inherit;
		overflow: hidden;
	}
</style>