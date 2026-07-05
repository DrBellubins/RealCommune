<script lang="ts">
  import { onMount } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';

  let container: HTMLDivElement;
  let map: maplibregl.Map | undefined;

  onMount(() => {
    map = new maplibregl.Map({
      container,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [12.5, 41.9],
      zoom: 13
    });

    return () => {
      map?.remove();
    };
  });
</script>

<div bind:this={container} class="map"></div>

<style>
  .map {
    width: 100%;
    height: 70vh;
    border-radius: 12px;
  }
</style>