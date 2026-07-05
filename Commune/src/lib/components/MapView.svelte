<script lang="ts">
  import { onMount } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import type { FakeUser } from '$lib/data/fakeUsers';

  let {
    users = [],
    onUserSelect
  } = $props<{
    users?: FakeUser[];
    onUserSelect?: (user: FakeUser) => void;
  }>();

  let container: HTMLDivElement;
  let map = $state<maplibregl.Map | undefined>();
  let mapReady = $state(false);
  let markers = $state<maplibregl.Marker[]>([]);

  function clearMarkers() {
    for (const marker of markers) {
      marker.remove();
    }

    markers = [];
  }

  function syncMarkers() {
    if (!map) {
      return;
    }

    clearMarkers();

    for (const user of users) {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'user-dot';
      element.title = user.name;
      element.setAttribute('aria-label', `Open profile for ${user.name}`);

      element.addEventListener('click', () => {
        onUserSelect?.(user);
      });

      const marker = new maplibregl.Marker({ element })
        .setLngLat([user.longitude, user.latitude])
        .addTo(map);

      markers.push(marker);
    }
  }

  onMount(() => {
    map = new maplibregl.Map({
      container,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [12.5, 41.9],
      zoom: 13
    });

    map.on('load', () => {
      mapReady = true;
    });

    return () => {
      clearMarkers();
      mapReady = false;
      map?.remove();
    };
  });

  $effect(() => {
    users;

    if (mapReady) {
      syncMarkers();
    }
  });
</script>

<div bind:this={container} class="map"></div>

<style>
  :global(.user-dot) {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.95);
    background: radial-gradient(circle at 30% 30%, #9fe0ff, #2e7bff);
    box-shadow: 0 0 0 8px rgba(72, 145, 255, 0.2);
    cursor: pointer;
    padding: 0;
  }

  :global(.user-dot:hover) {
    transform: scale(1.12);
  }

  .map {
    width: 100%;
    height: min(72vh, 44rem);
    border-radius: 12px;
    overflow: hidden;
  }
</style>