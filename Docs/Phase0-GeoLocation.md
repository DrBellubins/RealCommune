# Phase 0, Step 2 — Real Geolocation Pipeline

Comprehensive outline of what is required to implement P0 #2 in `Docs/TODO.md`:

> **2. Real geolocation pipeline (the heart of the product)**
> *Current state: none. Locations are static fields on fake users.*

| TODO checkbox | Section in this doc |
|---|---|
| Location ingest API (rate-limited, rejects stale/spoofed points) | §7–8 |
| Location store (current position + short history, indexed for radius queries) | §6 |
| Distance queries ("who is within X miles") | §7 |
| Infrequent background geolocation (always permission, background grabs, offline batching) | §9 |
| Position freshness policy (stale → hidden) | §7.4 |
| Accuracy threshold (too-poor GPS not posted) | §7.3 |

**Deliverable:** two signed-in users on different devices (or two browser profiles with the
dev location simulator) can see each other's live dots on the map; dots appear within one
upload interval of movement, disappear after the freshness window lapses, and every
invalid point is rejected with a reason — no fake coordinates anywhere.

---

## 1. Current-state audit (verified in working tree)

| Fact | Evidence |
|---|---|
| No location code exists anywhere | `src/lib` contains only `components`, `data`, `actions`, empty `map/`, `server` |
| Positions are static fields on fake users | `src/lib/data/fakeUsers.ts` (`latitude`/`longitude` hardcoded, Rome) |
| DB is SQLite via better-sqlite3 + Drizzle | `package.json`, `src/lib/server/db/index.ts`, `drizzle.config.ts` (`dialect: 'sqlite'`, `local.db`) |
| Schema has only `task` (stray), `chatMessage`, better-auth tables | `src/lib/server/db/schema.ts`, `auth.schema.ts` — no position table |
| Auth is wired only to `/demo/better-auth` | `src/routes/demo/` still present; `hooks.server.ts` sets `locals.user` but has **no** `/api/*` guard |
| **Step 1 (auth) is documented but not applied to this tree** | `Docs/phase0-step1-auth.md` exists, but `src/routes/auth/` and `src/routes/+page.server.ts` do not, and `testClient` is still used in `+page.svelte` |
| No tests, no CI, no realtime transport | `package.json` (no test runner), no `vitest`/`ws`/`sse` deps |
| Empty `src/lib/map/` directory | exists, unused — free to use or ignore |

## 2. Prerequisite: apply Phase 0, Step 1

Step 2 depends on step 1 (`Docs/phase0-step1-auth.md`) for:

1. **Session on every `/api/*`** (step 1 item 7) — the ingest endpoint must be
   authenticated, keyed to `locals.user.id`. Without it, anyone can post positions for
   any user.
2. **`MapUser.position: { latitude, longitude } | null`** shape (step 1 item 1) — the map
   layer already skips users without a position; step 2 fills that field from the store.
3. **`getMapUsersFor(requester)`** server query (step 1 item 3) — step 2 extends it to
   join the position store (§7.5, §10).
4. **Real user IDs** replacing `testClient` — ingest is per-user; there is no anonymous
   `testClient` to attribute a position to.

**Action:** if step 1 is not applied yet, apply `Docs/phase0-step1-auth.md` first
(`npm run db:push` for the `userProfile` table), verify its "Expected" section, then
start step 2. Everything below assumes step 1 is in.

## 3. Decisions to make up front (pick defaults, record overrides)

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | **DB for spatial queries** | (a) stay on SQLite: haversine computed in JS/SQL + bounding-box prefilter + geohash index column; (b) migrate to Postgres + PostGIS first (P4 #15 suggests "do this before the location store if possible") | **(a) SQLite now.** Prototype scale (dozens–hundreds of fresh positions), zero infra change, keeps the existing `npm run db:push` workflow. Keep ALL spatial math in one module (`geo.ts`) behind a `whoWithin()` interface so the PostGIS swap in P4 #15 is a localized change. Revisit when concurrent users > ~1k or queries stop being < 10 ms. |
| D2 | **Freshness threshold** | how long a position stays "current" before the dot is hidden | **10 minutes** (`STALE_AFTER_MS = 600_000`). Rationale: with a 30 s foreground cadence, 10 min ≈ 20 missed uploads — long enough for elevator/underpass GPS loss, short enough that the map is honest. Config, not code. |
| D3 | **Accuracy threshold** | max GPS accuracy that will be posted | **50 m** (`MAX_ACCURACY_M = 50`). Phone GPS outdoors is typically 3–20 m; > 50 m usually means indoor/cold-start — posting it would place the dot at street-level wrong. Config. |
| D4 | **Upload cadence** | foreground interval; background interval | Foreground **30 s** or **≥ 25 m movement** (whichever first). Background (native, P4 #14) **5 min** — "infrequent" per spec rule 12. Both config. |
| D5 | **Spoofing/teleport policy** | how aggressive to be about impossible jumps | Lenient sanity check only: reject if implied speed between consecutive accepted points **> 150 m/s (~540 km/h / 340 mph)**. Catches kilometer-scale fake jumps (the common spoof), never catches real driving/flight. Rejection logged (reason string) for tuning. Real anti-abuse (multi-device radius gaming, etc.) is P4 #13. |
| D6 | **Self-dot source** | server round-trip vs. client's own watch | **Client-side**: User1's own dot renders from the local `watchPosition` value (instant, no round trip); server load provides the last known position as the pre-first-fix fallback. |
| D7 | **How the map refreshes** | realtime vs. polling | **Polling every 45 s** (visibility-gated) against `GET /api/map/users`. No realtime transport exists (that's P1 #7); polling is the honest interim and reuses the same endpoint the page load uses. |
| D8 | **Client architecture for background location** | native now vs. web now + native later | **Web now (PWA-with-caveats, per TODO wording), native abstraction-ready.** A stable `LocationClient` interface means the Capacitor geolocation plugin (P4 #14) is a drop-in: same ingest endpoint, same queue. iOS PWA cannot do true background grabs — documented limitation, not a blocker for the pipeline. |

## 4. Named constants & config (no magic numbers)

New shared module `src/lib/location/constants.ts` (used by both client and server;
server overrides via env in `src/lib/server/location/config.ts`):

| Constant | Default | Meaning |
|---|---|---|
| `FRIEND_RADIUS_MILES` | 25 | Friend interaction radius (spec rule 1) — defined here so P0 #4 reuses it |
| `NEIGHBOR_RADIUS_MILES` | 1 | Neighbor interaction radius (spec rule 3) — defined here so P1 #5 reuses it |
| `COMBINED_RADIUS_MILES` | 50 | Contact-pair combined visibility (spec rule 6) — for P0 #4 |
| `METERS_PER_MILE` | 1609.344 | unit conversion |
| `MAX_ACCURACY_M` | 50 | D3 |
| `STALE_AFTER_MS` | 600 000 | D2 — freshness |
| `PRUNE_AFTER_MS` | 86 400 000 | delete current-position rows older than 24 h |
| `HISTORY_RETENTION_MS` | 7 200 000 | keep 2 h of `positionHistory` (feeds driving detection P1 #8 and dwell P1 #5) |
| `MAX_CLOCK_SKEW_MS` | 300 000 | reject points whose `capturedAt` is > 5 min from server clock |
| `MAX_PLAUSIBLE_SPEED_MPS` | 150 | D5 |
| `MIN_INGEST_INTERVAL_MS` | 15 000 | min gap between accepted points for a user |
| `MAX_BATCH_SIZE` | 20 | max points per ingest request |
| `MAX_INGEST_REQ_PER_MIN` | 4 | per-user request rate limit (sliding window) |
| `FOREGROUND_INTERVAL_MS` | 30 000 | D4 |
| `MIN_MOVE_M` | 25 | D4 movement trigger |

`.env.example` additions (server-side ones): `LOCATION_MAX_ACCURACY_M`,
`LOCATION_STALE_MS`, `LOCATION_PRUNE_MS`, `LOCATION_HISTORY_RETENTION_MS`,
`LOCATION_MAX_CLOCK_SKEW_MS`, `LOCATION_MAX_SPEED_MPS`,
`LOCATION_MIN_INGEST_INTERVAL_MS`, `LOCATION_MAX_BATCH_SIZE`,
`LOCATION_MAX_REQ_PER_MIN`. Every one has the table default when unset (dev-friendly).

## 5. Data model

Two tables in `src/lib/server/db/schema.ts` (Drizzle, SQLite dialect now; Postgres
variants noted where different):

### 5.1 `currentPosition` — one row per user (user → latest position)

```ts
export const currentPosition = sqliteTable('currentPosition',
{
	userId:      text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
	latitude:    real('latitude').notNull(),          // WGS-84, -90..90
	longitude:   real('longitude').notNull(),         // WGS-84, -180..180
	accuracyM:   real('accuracy_m').notNull(),        // GPS accuracy, meters
	speedMps:    real('speed_mps'),                   // null when engine unavailable
	headingDeg:  real('heading_deg'),                 // null when stationary/unavailable
	capturedAt:  integer('captured_at').notNull(),    // epoch ms, device clock (validated vs server)
	receivedAt:  integer('received_at').notNull(),    // epoch ms, server clock (source of truth for freshness)
	geohash:     text('geohash')                      // 7-char prefix, coarse index (see §7.2)
}, (t) => [index('currentPosition_receivedAt_idx').on(t.receivedAt)]);
```

- `receivedAt` (server clock) drives **freshness** — never trust device clocks for it.
- `capturedAt` is kept for ordering/dedup and for driving-detection time deltas.
- `geohash`: 7-char prefix (≈ 300 m cells) with a B-tree index — cheap insurance for
  radius prefiltering. At current scale the real work is the `receivedAt` freshness
  predicate (one row per user anyway); the geohash index is what makes the PostGIS
  swap trivial later. (Postgres variant: `point geography(4326)` + GiST index instead.)

### 5.2 `positionHistory` — short rolling history (driving detection + dwell feed)

```ts
export const positionHistory = sqliteTable('positionHistory',
{
	userId:      text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	latitude:    real('latitude').notNull(),
	longitude:   real('longitude').notNull(),
	accuracyM:   real('accuracy_m').notNull(),
	speedMps:    real('speed_mps'),
	headingDeg:  real('heading_deg'),
	capturedAt:  integer('captured_at').notNull(),
	receivedAt:  integer('received_at').notNull(),
}, (t) => [
	index('positionHistory_user_captured_idx').on(t.userId, t.capturedAt),
	index('positionHistory_captured_idx').on(t.capturedAt)   // enables retention pruning
]);
```

- Written on every **accepted** ingest point; pruned beyond `HISTORY_RETENTION_MS`
  (2 h) by the retention job (§7.6).
- This is the data P1 #8 (driving/flying heuristic: sustained `speedMps` + heading
  variance) and P1 #5 (co-presence dwell) consume — building it now means those
  features are pure readers, no backfill.

### 5.3 Migration

Dev workflow stays `npm run db:push` (no migration runner yet — P4 #15). Run it once
after the schema edit; verify with `npm run db:studio`.

## 6. Location store (server module)

`src/lib/server/location/store.ts`:

- **`ingestPoints(userId, points)`** — validates each point (§7.3), applies ordering/
  rate limits, upserts `currentPosition`, appends to `positionHistory`, returns
  `{ accepted: number, rejected: { index, reason }[] }`. Transactional per request.
  `reason` enum values (stable strings, logged + returned to caller for the dev
  simulator): `invalid_coords`, `bad_accuracy`, `clock_skew`, `stale_order` (out-of-order
  vs. last accepted `capturedAt`), `teleport`, `rate_limited`, `batch_too_large`.
- **`getFreshPositions(excludeUserId?, staleAfterMs)`** — returns `currentPosition`
  rows where `receivedAt >= now - staleAfterMs` (single indexed scan).
- **`getLatestFor(userId)`** — for the page-load self fallback (D6).
- **`prune(now)`** — delete `currentPosition` rows older than `PRUNE_AFTER_MS`; delete
  `positionHistory` rows older than `HISTORY_RETENTION_MS`. Called lazily: at most once
  per 15 min per server process (module-level timestamp guard) on ingest, plus a
  `setInterval` in the server entry so an idle server still prunes.

## 7. Spatial & validation logic

### 7.1 `src/lib/location/geo.ts` (pure, unit-testable, no I/O)

- `haversineMeters(lat1, lng1, lat2, lng2): number` —
  `d = 2R·asin(√(sin²(Δφ/2) + cos φ1·cos φ2·sin²(Δλ/2)))`, `R = 6371008.8 m` (mean).
  (The Vincenty/law-of-cosines refinements aren't needed at km scale.)
- `boundingBox(lat, lng, radiusM)` → `{ minLat, maxLat, minLng, maxLng }` —
  `Δlat = radiusM / 111_320`; `Δlng = radiusM / (111_320 · cos(φ))` (clamp φ to avoid
  the pole; at Commune's scales φ ≈ city latitudes).
- `withinRadiusM(lat1, lng1, lat2, lng2, radiusM): boolean`
- `toGeohash(lat, lng, precision = 7): string` — small dependency-free encoder
  (~40 lines) or a 1-kb npm dep (`ngeohash`); pick one, keep the call site identical.
- **`whoWithin(center: {lat,lng}, radiusM, rows): Row[]`** — the radius-query
  interface P0 #4's visibility engine will call. Implementation now: bounding-box
  predicate (SQL `WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`) then
  exact haversine filter in JS. PostGIS variant later: `ST_DWithin(geogpoint, point, m)`.

### 7.2 Index strategy (D1 = SQLite)

`currentPosition` has exactly one row per user. Radius query path:

1. `WHERE received_at >= ?` (freshness; indexed) — in practice returns the whole table
   at prototype scale;
2. `AND (latitude BETWEEN ? AND longitude BETWEEN ?)` bounding box (B-tree index
   `(latitude, longitude)`);
3. exact haversine in JS (a few dozen rows max at this stage).

That satisfies "indexed for radius queries" without a Postgres dependency, and step 3
is the one that stays correct as the radius engine (P0 #4) layers on top.

### 7.3 Per-point validation (ingest, in order — first failure wins)

| # | Rule | Reject reason |
|---|---|---|
| 1 | `lat`/`lng` finite, in range; `accuracyM` finite > 0; `capturedAt` numeric | `invalid_coords` |
| 2 | `accuracyM <= MAX_ACCURACY_M` (50 m) — **the accuracy-threshold checkbox** | `bad_accuracy` |
| 3 | `|serverNow - capturedAt| <= MAX_CLOCK_SKEW_MS` (5 min) — **clock-skew sanity** | `clock_skew` |
| 4 | `capturedAt >= lastAcceptedCapturedAt(userId)` — **stale/out-of-order rejection**; equal ⇒ duplicate, skip as accepted-noop | `stale_order` |
| 5 | implied speed `haversine(prev, cur) / Δt <= MAX_PLAUSIBLE_SPEED_MPS` when Δt > 0 — **spoofing sanity** | `teleport` |
| 6 | request-level: ≤ `MAX_BATCH_SIZE` points, ≥ `MIN_INGEST_INTERVAL_MS` between accepted points, ≤ `MAX_INGEST_REQ_PER_MIN` requests/min per user (in-memory sliding window keyed by userId) | `batch_too_large` / `rate_limited` |

Rule 4 is what makes the offline batch flush (§9.4) safe: a late-arriving batch that
overlaps already-accepted points is a no-op, never a rewind.
The client pre-filters rule 2 (accuracy) before queueing, to save bandwidth — the
server check is authoritative.

### 7.4 Position freshness policy

| Age of `receivedAt` (server clock) | Map behavior | Store behavior |
|---|---|---|
| ≤ `STALE_AFTER_MS` (10 min) | **dot shown** ("current") | current + history |
| > 10 min, ≤ 24 h | dot **hidden** (position treated as off-map); data retained for P2 #10 "last seen" | current + history |
| > 24 h | n/a | row deleted by prune job |

Freshness is evaluated **at query time** (`getFreshPositions`), not by a timer — no
cron needed for the map to be correct; the prune job only controls storage.

### 7.5 Distance-query surface

- `whoWithin()` (§7.1) is the single radius primitive. P0 #4's visibility resolver
  (contacts ≤ 50 mi, non-contacts ≤ 25 mi, neighbors ≤ 1 mi grey) is built **on top of**
  it — step 2 deliberately does not implement relationship rules.
- `getMapUsersFor(requester)` (step 1) is extended: LEFT JOIN `currentPosition`,
  map only **fresh** rows into `MapUser.position`; non-fresh ⇒ `position: null`
  (the marker layer already skips null positions — zero component changes for
  stale hiding).

### 7.6 Retention/prune job

Module-level lazy + `setInterval(15 min)`: `prune(now)`. Log deleted row counts.
No external scheduler dependency (P4 #15 may replace with a proper worker later).

## 8. API design

All endpoints inherit the step-1 session guard in `hooks.server.ts`
(`/api/*` ⇒ 401 without session; `/api/better-auth/*` excluded).

### 8.1 `POST /api/location` — ingest

Request (single point = batch of 1):

```json
{
  "points": [
    {
      "lat": 41.8923,
      "lng": 12.4821,
      "accuracyM": 8.2,
      "capturedAt": 1791234567890,
      "speedMps": 1.4,
      "headingDeg": 203
    }
  ]
}
```

- `speedMps` / `headingDeg` optional (null-allowed) — fed to P1 #8 later.
- 200 → `{ "accepted": 2, "rejected": [{ "index": 1, "reason": "bad_accuracy" }] }`
  (207-style partial success; client logs `rejected` for the dev simulator).
- 400 malformed body; 401 no session; 429 `rate_limited`.
- Validation errors are **per-point** (§7.3), never a whole-request 500.

### 8.2 `GET /api/map/users` — visibility set (interim shape)

Returns the same `users: MapUser[]` shape the step-1 page load uses (via
`getMapUsersFor` + fresh positions, §7.5). Used by the 45 s polling loop (D7).
**Note:** P0 #4 replaces this endpoint's contents with the full radius/contacts
resolver — the endpoint itself survives; only the query changes.

### 8.3 (no extra endpoint for self)

User1's own position comes from (a) the local geolocation watch (D6) and (b)
`getLatestFor(me.id)` included in the page server load as the fallback shown before
the first fix. Keeps the API surface at two endpoints.

## 9. Client location pipeline

New client modules (browser-only; guard with `browser` from `$app/environment`):

| File | Role |
|---|---|
| `src/lib/client/location/LocationClient.svelte.ts` | Rune state: `permission`, `fix` (latest valid point), `uploading`, `queued`; owns `watchPosition`, cadence, upload, queue flush |
| `src/lib/client/location/queue.ts` | Minimal hand-rolled IndexedDB queue (~60 lines, no dep): `enqueue(point)`, `drain(max)` in FIFO order |

### 9.1 Permission flow

1. On first map visit, request via the watch (SvelteKit runs on https/localhost,
   where geolocation is permitted).
2. `LocationClient` exposes reactive `permission: 'granted' | 'denied' | 'prompt' |
   'unavailable'`. UI (small banner in the map, styled like the step-1 session chip):
   - `prompt` → "Enable location to appear on the map" button that re-requests.
   - `denied` → explanation + "open browser settings" hint. No crash, no retry spam
     (one re-request per user gesture).
   - `unavailable` (non-secure context / very old browser) → note it.

### 9.2 Foreground grab (what "infrequent background" means on web today)

- `navigator.geolocation.watchPosition({ enableHighAccuracy: true, maximumAge: 0,
  timeout: 10_000 })`.
- Upload cadence (D4): send when `now - lastUpload >= FOREGROUND_INTERVAL_MS (30 s)`
  **or** `haversine(lastAccepted, fix) >= MIN_MOVE_M (25 m)` — whichever first.
- Pre-filter: skip queue/upload entirely when `accuracyM > MAX_ACCURACY_M` (server
  still enforces).
- **Visibility-gated:** on `visibilitychange` → hidden: stop uploading (and, on the
  simulator, stop emitting). On → visible: immediate upload + queue flush. This is the
  honest PWA behavior; document it as the limitation.

### 9.3 "Always" permission / true background grabs — documented path

Per TODO wording and spec rule 12, the *product* requirement is infrequent background
grabs with `permission: 'always'`. What step 2 delivers and defers:

- **Delivered now:** the entire server-side contract + a `LocationClient` whose
  *emitter* is swappable. A web page can only grab while visible/focused (D8).
- **Deferred to P4 #14 (Capacitor decision):** `@capacitor/geolocation`
  `BackgroundModes` on iOS (`NSLocationAlwaysAndWhenInUseUsageDescription`,
  `BGAppRefreshTask`-grade scheduling, 5-min cadence), Android foreground service /
  WorkManager. The native emitter calls the same `ingest(points)` + same IndexedDB
  queue — no server change. This section exists so the deferral is explicit, not
  accidental.

### 9.4 Offline queue & batch upload (the "batch/queue when offline" checkbox)

1. Every qualifying fix is **enqueued to IndexedDB first, then uploaded**
   (store-and-forward; at-wifi or on-metered is the same — points are ~100 bytes).
2. On successful upload of a point, remove it from the queue.
3. On `online` event and on visibility→visible: `drain(MAX_BATCH_SIZE)` → one
   `POST /api/location` with up to 20 points (oldest first).
4. Server rule 4 (`stale_order`) makes overlap/duplication after reconnect a no-op —
   the queue may double-send without harm.
5. Queue cap: 200 points; on overflow drop oldest (a 2-day-old point is worthless
   and would be rejected as stale anyway).
6. `speedMps`/`headingDeg` from the `Position` object when present (`coords.speed`,
   `coords.heading`) — `null` when the platform omits them (common on iOS).

### 9.5 Dev location simulator (required for testing §11.2)

- Dev-only (`import.meta.env.DEV`): a small floating panel (bottom-left, matching the
  session-chip style) with two modes:
  - **Real** (default): uses the device GPS via `LocationClient`.
  - **Simulated**: emits synthetic points through the *same* pipeline
    (queue → upload) from a set of preset tracks (e.g., "walking 4 km/h loop",
    "teleport 5 km jump" for rejection testing, "jittery 80 m accuracy" for
    `bad_accuracy`), at a fast 5 s cadence so tests don't wait 30 s.
- It must produce the same wire format as the real emitter — the simulator is a
  substitute for the GPS, not for the pipeline.

## 10. Map & UI integration

| Change | File | Detail |
|---|---|---|
| Polling loop | `+page.svelte` | `$effect`: while page visible, `fetch('/api/map/users')` every 45 s (D7) → replace `users` state; stop when hidden; immediate refetch after each own successful upload (feedback loop: my dot + others refresh together). Initial data still from page load. |
| Own dot (D6) | `+page.svelte` | `self` state: `LocationClient.fix` live value; pre-fix fallback from page-load `me.position`. Passed to the marker layer as a separate prop, not mixed into `users`. |
| Self-marker style | `UserMarkerLayer.svelte` | New `self` prop: distinct marker (e.g., white ring + blue fill, slightly larger, non-interactive/clickable-suppressed). Kept **not green** (rule 10: green reserved for events). Others keep the existing blue radial dot until P2 #12. |
| Stale hiding | none (free) | `getMapUsersFor` returns `position: null` for stale users (step 1's `!user.position → continue` already skips them). |
| Center on self | `MapView.svelte` | Optional nicety: on first non-null self fix, one-time `map.flyTo` to self (guarded so it never fights the existing chat-centering logic). |
| Permission banner | new `LocationStatus.svelte` | renders `LocationClient.permission` states (§9.1). |
| Sign-out / session bar | unchanged | already handles the auth state. |

## 11. Testing

### 11.1 Unit tests — add Vitest now (P4 #15 asks for tests repo-wide; start here)

`package.json`: `vitest` devDep, `"test": "vitest run"` script. Test files:

| File | Cases (minimum) |
|---|---|
| `test/geo.test.ts` | haversine: same point = 0; known pair (Rome center ↔ Colosseum ≈ 0.8 km) ±1 %; antipodal sanity; bounding box contains/ excludes edge points; `withinRadiusM` boundary: point exactly at 25 mi boundary (± epsilon both sides); geohash round-trip stability |
| `test/ingest.test.ts` | each reject reason fires on purpose (`invalid_coords`, `bad_accuracy` at 51 m, `clock_skew` at +6 min, `stale_order` rewind, `teleport` 5 km in 10 s, `rate_limited` 5 rapid requests, `batch_too_large` 21 points); accepted points upsert `currentPosition` and append `positionHistory`; duplicate `capturedAt` is accepted-noop; two users don't interfere |
| `test/freshness.test.ts` | row at `now-9min` is fresh; `now-11min` is not (`STALE_AFTER_MS` boundary); `getFreshPositions` excludes other users' rows correctly; prune removes >24 h rows, keeps 24 h−1 s |
| `test/whoWithin.test.ts` | seeded points: 24.9 mi included, 25.1 mi excluded; 1 mi neighbor boundary; box prefilter never drops a true positive (property: JS haversine pass ⇒ box pass) |

Tests use a throwaway SQLite file (`:memory:` or temp file) created per test — no
fixture DB committed.

### 11.2 Manual verification matrix (after each milestone)

| # | Scenario | Expected |
|---|---|---|
| V1 | User A (simulator, walking) on profile 1; User B on profile 2 | B's map shows A's dot within one upload interval |
| V2 | A idle, wait 11 min (simulator fast-forward or temp `STALE_AFTER_MS=60 s`) | A's dot disappears from B's map |
| V3 | A emits `bad_accuracy` track | no dot movement; A's simulator shows `rejected: bad_accuracy` |
| V4 | A teleports 5 km | point rejected (`teleport`), A stays at last valid dot |
| V5 | Kill A's network for 2 min, restore | queue flushes on reconnect; B sees A reappear (not rewind); no duplicate dots |
| V6 | Deny location permission | banner explains; app still usable; no console errors |
| V7 | Sign out / unauthenticated fetch of `POST /api/location` | 401 |
| V8 | Two devices with different clocks (skew > 5 min) | point rejected `clock_skew`, logged |
| V9 | Reload page before first fix | self dot shows last server-known position, then live fix takes over |

## 12. Security & privacy checklist

- [ ] Ingest requires session; `userId` **always** from `locals.user`, never from the body (step-1 hook).
- [ ] No endpoint returns any user's raw position except through `getMapUsersFor` (today: everyone-fresh; P0 #4 will narrow it — the query function is the single choke point).
- [ ] Rejections (including `teleport`) logged with reason + userId for spoofing forensics; never echoed beyond the sender's own client.
- [ ] Queue is per-origin (IndexedDB) — no cross-tab leakage beyond the same browser profile.
- [ ] `capturedAt` never used for freshness (device clock untrusted) — `receivedAt` only.
- [ ] Rate limits are per-user (sliding window), with a global per-process cap as backstop.
- [ ] Deeper anti-abuse (multi-device radius gaming, IP correlation, GPS-spoof
      heuristics beyond D5) is explicitly P4 #13 — noted, not implemented here.

## 13. File plan

**New**

| File | Purpose |
|---|---|
| `src/lib/location/constants.ts` | §4 table |
| `src/lib/location/geo.ts` | §7.1 pure spatial math |
| `src/lib/server/location/config.ts` | env → §4 values with defaults |
| `src/lib/server/location/store.ts` | §6 ingest/query/prune |
| `src/routes/api/location/+server.ts` | §8.1 |
| `src/routes/api/map/users/+server.ts` | §8.2 |
| `src/lib/client/location/LocationClient.svelte.ts` | §9 |
| `src/lib/client/location/queue.ts` | §9.4 IndexedDB FIFO |
| `src/lib/components/LocationStatus.svelte` | §9.1 banner |
| `src/lib/components/LocationSimulator.svelte` | §9.5 (dev-only) |
| `test/geo.test.ts`, `test/ingest.test.ts`, `test/freshness.test.ts`, `test/whoWithin.test.ts`, `vitest.config.ts` | §11.1 |

**Edited**

| File | Change |
|---|---|
| `src/lib/server/db/schema.ts` | §5 tables + indexes; `import { real } from 'drizzle-orm/sqlite-core'` |
| `src/lib/server/users.ts` | `getMapUsersFor` LEFT JOINs `currentPosition`, fresh ⇒ `position`, else null (§7.5) |
| `src/routes/+page.server.ts` | include `me.position` (own last-known, §8.3) |
| `src/routes/+page.svelte` | polling effect, `self` state, pass `self` + `users` to marker layer, mount `LocationClient`/`LocationStatus`/simulator |
| `src/lib/components/UserMarkerLayer.svelte` | `self` prop + self-marker style (§10) |
| `src/lib/components/MapView.svelte` | optional center-on-first-self-fix |
| `package.json` | `vitest` devDep + `test` script |
| `.env.example`, `src/app.d.ts` | §4 env vars + types |

**Deleted:** nothing (the stray `task` table removal stays P4 #15).

## 14. Build order (milestones)

Each milestone ends green (`npm run check && npm run lint && npm test`) with its
verification step.

1. **M0 — Prerequisite:** confirm step 1 applied (its "Expected" section passes). If
   not: apply `Docs/phase0-step1-auth.md` first.
2. **M1 — Math & config:** `constants.ts`, `geo.ts`, `config.ts`, all four test files
   green. *Verify:* `npm test` (no DB, no I/O).
3. **M2 — Store:** schema tables, `store.ts`, `npm run db:push`. *Verify:*
   `db:studio` shows both tables; a scripted `ingestPoints` + `getFreshPositions`
   round-trip (temp script, deleted after).
4. **M3 — Ingest API:** `POST /api/location` + `GET /api/map/users`, unit tests for
   rejection reasons pass against the real handler. *Verify:* V7 (401 unauthenticated),
   curl a valid point from a signed-in session, see it in `currentPosition`.
5. **M4 — Dots on the map:** `getMapUsersFor` position join, polling loop, self-dot,
   `LocationStatus` banner. *Verify:* V1, V9 with the dev simulator (real GPS optional).
6. **M5 — Client pipeline:** watch cadence, accuracy pre-filter, IndexedDB queue,
   offline flush, visibility gating, full simulator. *Verify:* V2–V6, V8.
7. **M6 — Hygiene & handoff:** prune job + logs, `.env.example`, update `TODO.md`
   checkboxes with dates, this doc's "done" markers. *Verify:* full V matrix once.

Estimated surface: ~10 new files, ~6 edits, 4 test files. The largest single piece is
`LocationClient` (~200 lines); everything else is small and isolated.

## 15. Acceptance criteria (per TODO checkbox)

- [ ] **Ingest API** — `POST /api/location` exists; session-gated; rate-limited
      (per-user interval + request window); rejects stale, out-of-order, skewed,
      over-accurate, and teleport points with per-point reasons. *(§7.3, §8.1, M3, V3/V4/V7/V8)*
- [ ] **Location store** — `currentPosition` (1 row/user, indexed) +
      `positionHistory` (2 h rolling, indexed); prune job; transactional ingest.
      *(§5, §6, M2)*
- [ ] **Distance queries** — `whoWithin()` with bounding-box prefilter + haversine;
      1/25/50-mile boundary behavior unit-tested; P0 #4 can call it unchanged.
      *(§7.1–7.2, M1/M3)*
- [ ] **Background geolocation** — foreground 30 s / 25 m cadence with permission UX;
      store-and-forward IndexedDB queue with batched reconnect upload; native
      always-permission path documented and architecturally ready (D8).
      *(§9, M5, V5)*
- [ ] **Freshness policy** — 10-min threshold (config); stale ⇒ dot hidden at query
      time; 24 h prune. *(§7.4, M4, V2)*
- [ ] **Accuracy threshold** — 50 m max, enforced server-side (authoritative) and
      pre-filtered client-side. *(§7.3 rule 2, M3, V3)*

## 16. Explicit deferrals (out of scope for step 2, by design)

| Deferred | Where it lands | Why it's fine now |
|---|---|---|
| Radius/contacts visibility rules (25/50/1 mi gating) | P0 #4 | `whoWithin()` is the primitive it consumes; map currently shows all fresh users (step-1 behavior) |
| Neighbor grey dots / dwell classification | P1 #5 | `positionHistory` already records the co-presence data it needs |
| Real-time push of dots/notifications | P1 #7 | 45 s polling (D7) is the interim; endpoints survive the swap |
| Driving/flying suppression of notifications | P1 #8 | `speedMps`/`headingDeg` already captured in both tables |
| True background grabs (iOS always / Android service) | P4 #14 | D8: emitter swappable; server contract identical |
| Anti-abuse beyond D5 sanity check | P4 #13 | rejection reasons are logged for tuning |
| SQLite → Postgres/PostGIS | P4 #15 | D1: `whoWithin()` is the only spatial surface to swap |
| "Last seen" display for stale contacts | P2 #10 | stale rows retained 24 h precisely so P2 can read them |
| Test runner/CI repo-wide | P4 #15 | Vitest is introduced here (M1) so its setup is reusable, not repeated |
