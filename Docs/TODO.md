# Commune — Design & Build Checklist

Comprehensive design checklist for Commune, a map/geolocation-first social platform.
Items are ordered **by biggest effect and most pertinent to the current codebase**.

## Glossary

| Term | Definition |
|---|---|
| **User1** | The current user (the one using the app). |
| **User2 / Other users** | Any user other than User1. |
| **Interaction radius** | The radius where instant messaging, vicinity notifications, etc. happen. Friend interaction radius = **25 miles**. Neighbor interaction radius = **1 mile**. |
| **Dots** | User dots shown on the map that can be clicked to open an instant-messaging window. |

## Core Design Rules (source of truth)

1. Users can **only contact someone they have never interacted with** if that person is within the friend interaction radius (25 mi). Once in contacts, chat works **at any distance**.
2. There is **no static "friends" system** — only a loose set of **contacts** (people you know), which User1 can optionally organize into **private custom groups** (e.g. "Work friends", "Basketball bros", "Close family"). Groups are never visible to other users.
3. **Neighbors** (User2s you've been around often, for extended periods — neighbors, coworkers) show as **grey, unnamed dots** (anonymity). User1 can optionally reach out to one and optionally choose whether to share their name.
4. **Map section**: main map where user dots and events appear. Users outside the applicable interaction radius **do not show up at all**.
5. **Contacts section**: page where contacts can be direct-messaged even if they're not on the map (outside radius).
6. **Radius combining**: the interaction radius between two contacts can combine, so if they are **< 50 miles apart** they still show up on the map, but User1 is **not notified until they are within 25 miles**.
7. **Notification gating**: User1 is only notified of another user's presence if User1 is **not driving/flying** (automatic detection, no reliance on airplane mode).
8. **Block system**: User1 can block User2. User1 is notified **whenever a blocked User2 is within the interaction radius**. User2 is **never** notified they've been blocked.
9. **Do Not Disturb (DND)**: prevents other users from being notified when User1 enters *their* interaction radius (i.e. User1's DND silences notifications to others about User1's presence).
10. **Dots & colors**: contact dot icons and colors are chosen by User1, **except green** (reserved on the map). Event icons are **always green** and keyed to event type (concert, fair, club, sports game, etc.). Neighbor dots are always grey and unnamed.
11. **Events**: only creatable by special **Event Organizer** accounts, which only Commune (the company) can grant.
12. **Mobile-first**: phone-based app for proper geolocation. Geolocation is grabbed **infrequently in the background** while the app isn't running.

---

## P0 — Foundations (biggest effect, blocking everything else)

### 1. Replace fake users with real, authenticated users

*Current state: `src/lib/data/fakeUsers.ts` hardcodes 4 fake users + a `testClient`; dots, popups, and chat all key off these. `auth.schema.ts` (better-auth: user/session/account/verification) already exists but is only wired to a demo route.*

- [ ] Wire real auth into the main app: login/signup flows, session validation in `hooks.server.ts`, per-user identity for the `testClient` concept
- [ ] Delete `fakeUsers.ts` once real users exist (or gate it behind a dev-only "demo mode")
- [ ] Persist each user's profile: display name, avatar, and a `role` field that includes an `event_organizer` flag (see Events)
- [ ] Define the API auth contract: all `/api/*` endpoints require a valid session; chat endpoints must verify the caller owns `senderId`

### 2. Real geolocation pipeline (the heart of the product)

*Current state: none. Locations are static fields on fake users.*

- [ ] **Location ingest API** — endpoint to receive `{ lat, lng, accuracy, timestamp, speed, heading }`; rate-limited; rejects stale points (clock skew / GPS spoofing sanity checks)
- [ ] **Location store** — server-side current-position table (user → latest position + short history for driving detection); indexed for radius queries
- [ ] **Distance queries** — spatial queries for "who is within X miles of User1" (PostGIS or haversine + bounding-box prefilter; see Infra section on moving off SQLite)
- [ ] **Infrequent background geolocation** — mobile app (or PWA-with-caveats): request `permission: 'always'` geolocation on iOS/Android; schedule background position grabs at a low frequency; batch/queue uploads when offline
- [ ] **Position freshness policy** — define how long a position stays "current" before a dot is hidden/degraded (e.g. stale > N min → treat as off-map)
- [ ] **Accuracy threshold** — if GPS accuracy is too poor, don't post the position

### 3. Contact model (loose contacts, no "friends")

*Current state: none.*

- [ ] `contact` relation table: `userIdA ↔ userIdB`, with metadata for **how it was formed** (e.g. `via_radius_meeting`, `via_neighbor_reachout`) and timestamps
- [ ] **Forming a contact**: when User1 and User2 are both within the 25-mile interaction radius, either party can initiate chat; the first contact adds the other party to their contacts (decide: automatic on first message, or explicit "add to contacts" — spec says loose contacts of "people you know," so recommend explicit + suggested)
- [ ] **Removing a contact** (distinct from blocking — see Block system)
- [ ] Contacts are the unit that enables **any-distance chat** and **combined 50-mile map visibility**

### 4. Map visibility + interaction-radius engine

*Current state: map shows all hardcoded users regardless of distance.*

- [ ] Server-side visibility resolver for User1's map, producing:
  - [ ] **Contacts**: visible if within the combined radius (≤ 50 mi); notify only when within 25 mi
  - [ ] **Non-contacts**: visible only within 25 mi (the "friend interaction radius")
  - [ ] **Neighbors**: visible as grey unnamed dots within their 1-mile neighbor interaction radius
  - [ ] **Everyone**: excluded entirely when outside their applicable radius
- [ ] **Radius-combining rule**: implement the <50-mile combined visibility for contact pairs, with the 25-mile notification threshold
- [ ] **Radius configuration**: make 25 mi / 1 mi named constants (or server-config), not magic numbers
- [ ] Map client: fetch the visibility set per session instead of hardcoding; render only returned dots; handle map pan/zoom beyond the set (no lazy loading of new users — radius is absolute, not viewport-based)
- [ ] **User1's own dot**: render User1's own position on the map (currently no self-marker)

---

## P1 — Core differentiating features

### 5. Neighbor (grey dot) system

- [ ] **Dwell detection**: server tracks co-presence (User1 and User2 within the 1-mile neighbor radius); accumulate time-over-days; classify as neighbor after a threshold (e.g. X hours total over Y days) — tuneable, needs a documented formula
- [ ] **Grey, unnamed dots**: render neighbor dots without a name; clicking opens a limited profile (grey dot, no name, "Frequent nearby user")
- [ ] **Opt-in reachout**: User1 can message the neighbor without knowing their name; a flag controls whether User1's name is shared with User2 for that conversation (choose at send time or per-conversation)
- [ ] **Reveal logic**: when the two users become contacts (e.g. within 25 mi of each other in person), the grey dot becomes a named dot for both
- [ ] Privacy: neighbor co-presence data is never shown to either user as raw data — only the aggregate grey-dot presence

### 6. Events + Event Organizer role

- [ ] `event` table: title, description, type, location (lat/lng), radius/area, start/end times, organizerId
- [ ] **Event types** with fixed **green** icon set: concert, fair, club, sports game, … (define the full type list + icon assets; green-only palette)
- [ ] `event_organizer` role flag on users; **only Commune (admin tooling) can grant it** — no self-service, no user-facing grant UI
- [ ] Event creation/management endpoints (organizer-only), event display on the map for users in range, event click → details popup
- [ ] Decide: can any in-radius user RSVP/message about an event, or is event-related social contact also gated? (recommend: events are informational; social contact still follows the radius rules)

### 7. Notification system

*Current state: no real-time channel of any kind — no WebSocket, no SSE, no polling. Chat loads once on mount.*

- [ ] **Transport**: pick and implement a real-time channel (WebSocket or SSE) for: message delivery, "User2 entered your radius", blocked-user alerts, DND state
- [ ] **Radius-entry notifications**: "User2 is within your interaction radius" — fires at the 25-mile boundary crossing (for contacts: only within 25 mi per the combining rule)
- [ ] **Presence gating**: only notify User1 if User1 is **not driving/flying** — see Motion detection
- [ ] **Blocked-user alerts**: notify User1 when a **blocked** User2 is within the interaction radius (bypasses DND, does not reveal anything to User2)
- [ ] **DND mode**: per-user toggle; when User1 has DND on, User2s are *not* notified when User1 enters their radius (asymmetric: affects outgoing presence notifications about User1)
- [ ] Notification center UI + per-User1 mutability of each notification category (except blocked-user alerts — decide if those are always-on)

### 8. Motion / in-transit detection (driving & flying)

- [ ] Client-side sensors: GPS `speed` + heading from position updates; optionally accel/gyro on mobile
- [ ] **Driving heuristic**: sustained speed above threshold (e.g. > 25 mph for N seconds), low heading variance
- [ ] **Flying heuristic**: speed sustained above ~100 mph, or barometer altitude climb (mobile barometer API where available)
- [ ] Report `inTransit: driving | flying | none` with the location ingest; server uses it to suppress notifications (no reliance on airplane mode, per spec)
- [ ] Fallback when sensors unavailable: conservative (assume not in transit) — document the tradeoff

### 9. Block system

- [ ] `block` table: blockingUserId → blockedUserId, with timestamp
- [ ] Block UI in User2's profile / contacts entry
- [ ] Effect of blocking: User2 can see nothing about User1; User1 sees nothing from User2 (chat disabled, dot hidden, notifications suppressed **except** the blocked-presence alert — see Notifications)
- [ ] **User2 is never notified** they are blocked; no API or map response may leak block state to User2 (visibility of a blocked user must be indistinguishable from "not in range / not a contact")
- [ ] Unblock flow; mutual block edge cases (User2 already blocked User1 first)

---

## P2 — Organization, personalization & the second section

### 10. Contacts page (second section)

- [ ] Two-tab / two-section app shell: **Map** | **Contacts** (currently single-page map only)
- [ ] Contacts list: every contact shown **regardless of distance**; per-contact status (on-map now / off-radius), last seen, unread badge
- [ ] Tapping a contact opens the chat (works at any distance, per spec)
- [ ] Tapping a contact with a known position: "show on map" (only meaningful if within combined radius — otherwise no position is shared)

### 11. Private custom groups

- [ ] `contactGroup` table (user-owned: name, color, sort order) + `contactGroupMember` (groupId ↔ contactId)
- [ ] Group CRUD in the Contacts section; a contact can be in multiple groups or none
- [ ] **Strictly private**: groups are per-User1; never included in any response for another user
- [ ] Group filters in the Contacts list; optionally filter map dots by group (User1's own view only)

### 12. Dot color & icon customization

- [ ] Per-contact customization stored per User1: dot color (with green **forbidden** — validate server-side and client-side) + optional icon
- [ ] Color palette UI excluding green shades; document "green" as a reserved range
- [ ] `UserMarkerLayer` currently renders one hardcoded blue radial-gradient dot for everyone — parameterize color/icon per user (grey for neighbors, event icons always green)
- [ ] Render priority/overlap: when dots cluster, decide z-order and clustering behavior (MapLibre clustering for dot layers once migrated from DOM markers, or keep DOM markers with a declutter strategy)

---

## P3 — Chat hardening

*Current state: `chatMessage` table + Drizzle `ChatDB` + `/api/chat` GET/POST exist and work for the demo, but messages are only loaded once on mount, there's no real-time delivery, no auth on the endpoints, and `conversationId` is client-constructed.*

- [ ] **Auth on chat endpoints** (see P0 #1): verify session, verify caller is `senderId`, reject tampered `recipientId`/`conversationId`
- [ ] **Conversation scoping**: derive conversation server-side from (sessionUser, peerUser); enforce that a conversation may only exist if the relationship rules allow messaging (contact, in-radius, or neighbor reachout)
- [ ] Real-time delivery via the P1 transport; unread counts; "typing" optional
- [ ] Message metadata: delivered/read receipts (decide scope), message delete (decide if unilateral or mutual)
- [ ] Pagination / lazy loading for long conversations (currently full history is loaded)
- [ ] Character limit + input validation + rate limiting
- [ ] Media in chat? (defer — not in spec; note the decision)

---

## P4 — Platform, privacy & infra

### 13. Privacy & safety

- [ ] Location privacy: raw coordinates never exposed outside the visibility resolver; no endpoint returns a user's position outside their allowed radius
- [ ] Rate limiting on location ingest (background frequency) and on message send
- [ ] Anti-abuse: prevent radius-gaming (two devices faking proximity), spoofed GPS rejection heuristics
- [ ] Data retention: location history retention policy (how long co-presence / position history is kept)
- [ ] Account deletion: cascade delete of contacts, groups, messages, locations
- [ ] Audit: admin (Commune) can see only what's needed to grant/revolve Event Organizer status

### 14. Mobile app strategy

- [ ] Decide: **native wrapper (Capacitor)** around the SvelteKit PWA vs. a dedicated mobile app that reuses the web UI
- [ ] Background geolocation implementation per platform: iOS `BGAppRefreshTask` / location always permission; Android foreground service or WorkManager schedule
- [ ] Battery/network budget: infrequent grabs + batched upload when back online (queue local positions, flush on connectivity)
- [ ] Push notifications (APNs/FCM) for radius-entry, blocked-user, and message alerts when app is backgrounded
- [ ] Sensor access for motion detection (P1 #8): motion/accelerometer/barometer permissions

### 15. Infrastructure & codebase upgrades

- [ ] **Migrate SQLite → Postgres** (current `local.db` + better-sqlite3 won't do multi-user radius queries or scale; PostGIS for spatial indexes) — do this before the location store in P0 #2 if possible, so the location pipeline is born spatial
- [ ] `drizzle.config.ts` / `ChatDB` refactors to the new DB; migration workflow (currently no migration runner beyond `drizzle-kit`)
- [ ] Move chat storage from a flat `conversationId` string key to proper `conversation` table with FKs to users
- [ ] **Tests**: none exist — add at minimum: radius engine unit tests (25/50/1 mi boundaries, combining rule, notification thresholds), dwell/neighbor classification tests, block/visibility indistinguishability tests
- [ ] **CI**: none exists — lint, typecheck, test pipeline on the repo (`DrBellubins/RealCommune`)
- [ ] Config: radius constants, dwell thresholds, notification flags via env/config, not code
- [ ] Remove the demo better-auth routes or fold them into the real auth flow; remove the stray `task` table from the schema
- [ ] Error handling + request validation library across all server routes

---

## Explicit non-goals / decisions to confirm

- [ ] Group visibility is **one-way private** — confirm no "share group" feature is ever wanted
- [ ] Event RSVP / event chat semantics (see P1 #6)
- [ ] Whether a neighbor grey-dot conversation is revealed to the other party as "anonymous User1" or hidden until they choose to reply with their identity
- [ ] Exact dwell thresholds for neighbor classification (needs tuning with real data)
- [ ] Whether blocked-user alerts are mandatory (unmuted by DND) — spec implies yes; confirm
- [ ] Media support in chat (out of current spec)
