# Phase 0, Step 1 — Replace fake users with real, authenticated users

Code snippets for all four checkboxes in `Docs/TODO.md` P0 #1:

- [x] Wire real auth into the main app: login/signup flows, session validation, per-user identity for `testClient`
- [x] Delete `fakeUsers.ts`
- [x] Persist each user's profile: display name, avatar, `role` incl. `event_organizer` flag
- [x] API auth contract: `/api/*` requires a session; chat verifies caller owns `senderId`

> **Version note (verified against installed `better-auth@1.4.21`):**
> The `npm run auth:schema` CLI (1.4.21) does **not** emit `schema.user.additionalFields`
> into the generated `auth.schema.ts` — it was tested and the extra fields are dropped.
> So the role/organizer flag lives in a plain `userProfile` table in the hand-maintained
> `schema.ts` instead. This keeps the generated file safe to regenerate and works with the
> existing `npm run db:push` workflow. Display name = existing `user.name`, avatar =
> existing `user.image`.

## Files

| # | File | Action |
|---|------|--------|
| 1 | `src/lib/data/users.ts` | New — shared `MapUser` type (moved out of `fakeUsers.ts`) |
| 2 | `src/lib/server/db/schema.ts` | Edit — add `userProfile` table |
| 3 | `src/lib/server/users.ts` | New — map-user query (real users, no positions yet) |
| 4 | `src/routes/auth/+page.server.ts` | New — login/signup/sign-out actions |
| 5 | `src/routes/auth/+page.svelte` | New — auth form |
| 6 | `src/routes/+page.server.ts` | New — session guard + page data |
| 7 | `src/hooks.server.ts` | Edit — all `/api/*` require a session |
| 8 | `src/routes/api/chat/+server.ts` | Edit — session + `senderId` ownership checks |
| 9 | `src/routes/+page.svelte` | Edit — real user replaces `testClient`, real users replace `fakeUsers` |
| 10 | `src/lib/components/UserMarkerLayer.svelte` | Edit — new type import; skip users without a position |
| 11 | `src/lib/components/ChatWindow.svelte` | Edit — new type import; `client` prop; position guard |
| 12 | `src/lib/components/UserPopup.svelte` | Edit — new type import; position guard |
| 13 | `src/lib/data/fakeUsers.ts` | Delete |
| 14 | `src/lib/data/chat.ts` | Edit — drop `initialConversations` (unused fake seed) |
| 15 | `src/routes/demo/` | Delete (optional) — superseded by `/auth` |

## Commands

```bash
cd Commune
npm run db:push   # creates the userProfile table
npm run dev
```

Expected: `/` redirects to `/auth` when signed out. Sign up with name + email +
password → lands on the map. The map shows **no dots yet** — real users have no
positions until the location pipeline (P0 #2). Chat works between any two signed-up
users (use two browser profiles / a second machine); conversations are keyed by real
user IDs.

Known deferrals (later phases, by design):
- `getMapUsersFor` returns all other real users until the visibility engine (P0 #4).
- Chat has no relationship scoping (contact/in-radius) yet — that's P3; step 1 enforces
  session + sender ownership only.
- `userProfile` rows are optional; queries LEFT JOIN and default to `role: 'member'`.
  The `event_organizer` flag will only be set by Commune admin tooling (P1 #6).

---

## 1. `src/lib/data/users.ts` (new)

```ts
export type MapUser =
{
	id: string;
	name: string;
	role: string;
	avatarUrl: string | null;
	status: 'online' | 'available' | 'away' | 'offline';
	/** null until the location pipeline (Phase 0, step 2) records a position */
	position: { latitude: number; longitude: number } | null;
	locationLabel: string | null;
	preview: string | null;
};
```

## 2. `src/lib/server/db/schema.ts` (edit)

Replace the import line:

```ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
```

with:

```ts
import { boolean, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth.schema';
```

Append at the end (before or after `chatMessage`, keeping `export * from './auth.schema';`):

```ts
/* ── User profile (1:1 with the better-auth `user` table) ─────────
 * Display name = user.name, avatar = user.image (auth table).
 * role: 'member' | 'event_organizer' — the event_organizer flag is
 * granted only by Commune admin tooling (P1 #6), never self-service.
 * Rows are optional; queries LEFT JOIN and default to 'member'.
 */
export const userProfile = sqliteTable('userProfile',
{
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	role: text('role').notNull().default('member'),
	isEventOrganizer: boolean('is_event_organizer').notNull().default(false)
});
```

## 3. `src/lib/server/users.ts` (new)

```ts
import { eq, neq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user, userProfile } from '$lib/server/db/schema';
import type { MapUser } from '$lib/data/users';

type MapUserRow =
{
	id: string;
	name: string;
	image: string | null;
	role: string | null;
	isEventOrganizer: boolean | null;
};

export function toMapUser(row: MapUserRow): MapUser
{
	return
	{
		id: row.id,
		name: row.name,
		role: row.role ?? 'member',
		avatarUrl: row.image,
		status: 'offline', // presence comes with the location pipeline (P0 #2)
		position: null,    // filled by the location store (P0 #2)
		locationLabel: null,
		preview: null
	};
}

/**
 * Set of users shown on the map for `requester`.
 * Until the visibility engine (P0 #4) exists, this returns every
 * other real user.
 */
export async function getMapUsersFor(requester: { id: string }): Promise<MapUser[]>
{
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			image: user.image,
			role: userProfile.role,
			isEventOrganizer: userProfile.isEventOrganizer
		})
		.from(user)
		.leftJoin(userProfile, eq(user.id, userProfile.userId))
		.where(neq(user.id, requester.id));

	return rows.map(toMapUser);
}
```

## 4. `src/routes/auth/+page.server.ts` (new)

Ported from the working demo route, callbacks now point at `/`:

```ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

export const load: PageServerLoad = (event) =>
{
	if (event.locals.user)
		return redirect(302, '/');
	return {};
};

export const actions: Actions =
{
	signInEmail: async (event) =>
	{
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		try
		{
			await auth.api.signInEmail({
				body: { email, password, callbackURL: '/' }
			});

			return redirect(302, '/');
		}
		catch (error)
		{
			if (error instanceof APIError)
				return fail(400, { message: error.message || 'Signin failed' });
			return fail(500, { message: 'Unexpected error' });
		}
	},
	signUpEmail: async (event) =>
	{
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const name = formData.get('name')?.toString() ?? '';

		try
		{
			await auth.api.signUpEmail({
				body: { email, password, name, callbackURL: '/' }
			});

			return redirect(302, '/');
		}
		catch (error)
		{
			if (error instanceof APIError)
				return fail(400, { message: error.message || 'Registration failed' });
			return fail(500, { message: 'Unexpected error' });
		}
	},
	signOut: async (event) =>
	{
		await auth.api.signOut({ headers: event.request.headers });
		return redirect(302, '/auth');
	}
};
```

## 5. `src/routes/auth/+page.svelte` (new)

```svelte
<script lang='ts'>
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<div class="auth-page">
	<h1>Commune</h1>

	<form method="post" action="?/signInEmail" use:enhance>
		<h2>Log in</h2>
		<label>
			Email
			<input type="email" name="email" required />
		</label>
		<label>
			Password
			<input type="password" name="password" required minlength="8" />
		</label>
		<button type="submit">Log in</button>
	</form>

	<form method="post" action="?/signUpEmail" use:enhance>
		<h2>Sign up</h2>
		<label>
			Name
			<input name="name" required />
		</label>
		<label>
			Email
			<input type="email" name="email" required />
		</label>
		<label>
			Password
			<input type="password" name="password" required minlength="8" />
		</label>
		<button type="submit">Sign up</button>
	</form>

	<p class="error">{form?.message ?? ''}</p>
</div>

<style>
	.auth-page
	{
		min-height: 100vh;
		display: grid;
		align-content: start;
		justify-items: center;
		gap: 1.5rem;
		padding: 3rem 1rem;
		background: #09111d;
		color: #f5f7fb;
	}

	h1
	{
		margin: 0;
		letter-spacing: 0.08em;
	}

	form
	{
		display: grid;
		gap: 0.75rem;
		width: min(22rem, 100%);
		padding: 1.25rem;
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.06);
	}

	h2
	{
		margin: 0;
		font-size: 1rem;
	}

	label
	{
		display: grid;
		gap: 0.25rem;
		font-size: 0.85rem;
		color: #c7d2e0;
	}

	input
	{
		padding: 0.6rem 0.7rem;
		border: 1px solid #33415a;
		border-radius: 0.6rem;
		background: #0d1626;
		color: inherit;
		font: inherit;
	}

	button
	{
		padding: 0.6rem 0.8rem;
		border: 0;
		border-radius: 0.6rem;
		background: #1688ff;
		color: white;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.error
	{
		color: #ff6b6b;
	}
</style>
```

## 6. `src/routes/+page.server.ts` (new)

Session validation for the main app + page data:

```ts
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { getMapUsersFor } from '$lib/server/users';

export const load: PageServerLoad = async (event) =>
{
	// Session validation: the main app requires a signed-in user
	if (!event.locals.user)
		return redirect(302, '/auth');

	const me = event.locals.user;

	return
	{
		me:
		{
			id: me.id,
			name: me.name,
			avatarUrl: me.image ?? null
		},
		users: await getMapUsersFor(me)
	};
};

export const actions: Actions =
{
	signOut: async (event) =>
	{
		await auth.api.signOut({ headers: event.request.headers });
		return redirect(302, '/auth');
	}
};
```

## 7. `src/hooks.server.ts` (replace)

Adds the API auth contract: every `/api/*` endpoint requires a valid session,
except the better-auth API itself (sign in/up must work unauthenticated):

```ts
import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const handleBetterAuth: Handle = async ({ event, resolve }) =>
{
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session)
	{
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	// Every /api/* endpoint requires a valid session — except the
	// better-auth API itself. (Adjust the prefix if you change the
	// svelteKitHandler `base` option.)
	const isProtectedApi =
		event.url.pathname.startsWith('/api/') &&
		!event.url.pathname.startsWith('/api/better-auth');

	if (isProtectedApi && !event.locals.user)
	{
		return new Response(
			JSON.stringify({ error: 'Authentication required' }),
			{
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
```

## 8. `src/routes/api/chat/+server.ts` (replace)

```ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '../$types';
import { loadConversation, saveMessage } from '$lib/server/db/ChatDB';

/** conversationId is "<idA>:<idB>" with the two user ids sorted. */
function parseConversationId(conversationId: string): [string, string] | null
{
	const parts = conversationId.split(':');

	if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0)
		return null;

	return [...parts].sort() as [string, string];
}

export const GET: RequestHandler = async ({ url, locals }) =>
{
	if (!locals.user)
		return json({ error: 'Authentication required' }, { status: 401 });

	const conversationId = url.searchParams.get('conversationId');

	if (!conversationId)
		return json({ error: 'conversationId is required' }, { status: 400 });

	const pair = parseConversationId(conversationId);

	if (!pair || !pair.includes(locals.user.id))
		return json(
			{ error: 'You are not a participant of this conversation' },
			{ status: 403 });

	const messages = await loadConversation(conversationId);
	return json(messages);
};

export const POST: RequestHandler = async ({ request, locals }) =>
{
	if (!locals.user)
		return json({ error: 'Authentication required' }, { status: 401 });

	const body = await request.json().catch(() => null);

	if (
		!body ||
		typeof body.id !== 'string' ||
		typeof body.conversationId !== 'string' ||
		typeof body.senderId !== 'string' ||
		typeof body.recipientId !== 'string' ||
		typeof body.text !== 'string' ||
		typeof body.sentAt !== 'string'
	)
	{
		return json({ error: 'Invalid message payload' }, { status: 400 });
	}

	// The caller must be the sender — client-supplied senderId is untrusted
	if (body.senderId !== locals.user.id)
		return json(
			{ error: 'senderId must match the signed-in user' },
			{ status: 403 });

	// The conversation must be exactly (sender, recipient)
	const expectedId = [body.senderId, body.recipientId].sort().join(':');

	if (body.conversationId !== expectedId)
		return json(
			{ error: 'conversationId does not match the participants' },
			{ status: 403 });

	await saveMessage(body);
	return json({ ok: true });
};
```

## 9. `src/routes/+page.svelte` (targeted edits)

**a)** Script imports — replace:

```ts
	import
	{
		getConversationId,
		type ChatMessage,
		type ConversationMessages
	} from '$lib/data/chat';

	import { fakeUsers, testClient, type MapUser } from '$lib/data/fakeUsers';
```

with:

```ts
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	import
	{
		getConversationId,
		type ChatMessage,
		type ConversationMessages
	} from '$lib/data/chat';

	import type { MapUser } from '$lib/data/users';

	let { data }: { data: PageData } = $props();
```

**b)** `selectedMessages` derived — replace
`const conversationId = getConversationId(testClient.id, selectedUser.id);`
(the one inside `$derived.by`) with:

```ts
		const conversationId = getConversationId(data.me.id, selectedUser.id);
```

**c)** `onMount` — replace:

```ts
		for (const user of fakeUsers)
		{
			const conversationId = getConversationId(testClient.id, user.id);
```

with:

```ts
		for (const user of data.users)
		{
			const conversationId = getConversationId(data.me.id, user.id);
```

**d)** `sendMessage` — replace:

```ts
		const conversationId = getConversationId(testClient.id, selectedUser.id);
		const messageId = crypto.randomUUID();

		const message: ChatMessage =
		{
			id: messageId,
			senderId: testClient.id,
```

with:

```ts
		const conversationId = getConversationId(data.me.id, selectedUser.id);
		const messageId = crypto.randomUUID();

		const message: ChatMessage =
		{
			id: messageId,
			senderId: data.me.id,
```

**e)** `sendMessage` fetch body — replace `senderId: testClient.id,` (inside the
`JSON.stringify` payload) with `senderId: data.me.id,`.

**f)** Markup — replace:

```svelte
		<UserMarkerLayer
			{map}
			users={fakeUsers}
			onUserSelect={handleUserSelect}
		/>

		<ChatWindow
			{map}
			client={testClient}
```

with:

```svelte
		<UserMarkerLayer
			{map}
			users={data.users}
			onUserSelect={handleUserSelect}
		/>

		<ChatWindow
			{map}
			client={data.me}
```

**g)** Session bar — inside `<section class="page">`, before `<div class="map-shell">`,
insert:

```svelte
	<div class="session">
		<span>{data.me.name}</span>
		<form method="post" action="?/signOut" use:enhance>
			<button type="submit">Sign out</button>
		</form>
	</div>
```

and add to `<style>`:

```css
	.session
	{
		position: absolute;
		top: 1rem;
		right: 1rem;
		z-index: 20;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.4rem 0.8rem;
		border-radius: 2rem;
		background: rgba(255, 255, 255, 0.92);
		box-shadow: 0 0.25rem 1rem rgba(10, 29, 56, 0.2);
		color: #14233a;
	}

	.session form
	{
		margin: 0;
	}

	.session button
	{
		border: 0;
		background: transparent;
		color: #1688ff;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
```

## 10. `src/lib/components/UserMarkerLayer.svelte` (targeted edits)

**a)** Replace the type import:

```ts
	import type { MapUser } from '$lib/data/fakeUsers';
```

with:

```ts
	import type { MapUser } from '$lib/data/users';
```

**b)** In `renderMarkers`, skip users without a recorded position:

```ts
		for (const user of currentUsers)
		{
			// No position yet — the location pipeline is P0 #2
			if (!user.position)
			{
				continue;
			}
```

**c)** Replace
`}).setLngLat([user.longitude, user.latitude]).addTo(currentMap);`
with:

```ts
			}).setLngLat([user.position.longitude, user.position.latitude]).addTo(currentMap);
```

## 11. `src/lib/components/ChatWindow.svelte` (targeted edits)

**a)** Replace the type import (as in #10a) with:

```ts
	import type { MapUser } from '$lib/data/users';
```

**b)** The `client` prop only uses `.id`, so narrow it:

```ts
		client: { id: string; name: string };
```

**c)** Guard the null position in `updatePosition`:

```ts
	function updatePosition()
	{
		if (!map || !contact || !contact.position)
		{
			onGeometryChange?.(null);
			return;
		}

		const point = map.project(
		[contact.position.longitude, contact.position.latitude]);
```

## 12. `src/lib/components/UserPopup.svelte` (targeted edits)

**a)** Replace the type import (as in #10a) with:

```ts
	import type { MapUser } from '$lib/data/users';
```

**b)** Replace the coordinates line:

```svelte
					<dd>{user.latitude.toFixed(4)}, {user.longitude.toFixed(4)}</dd>
```

with:

```svelte
					<dd>{user.position
						? `${user.position.latitude.toFixed(4)}, ${user.position.longitude.toFixed(4)}`
						: 'No position recorded yet'}</dd>
```

(`{user.preview}` and `{user.locationLabel}` render fine as `null`.)

## 13–15. Deletions

```bash
rm src/lib/data/fakeUsers.ts
rm -rf src/routes/demo          # optional: superseded by /auth (P4 #15 asks for it anyway)
```

And in `src/lib/data/chat.ts`, delete the `initialConversations` const (fake seed
data, no usages — keep the `ChatMessage` / `ConversationMessages` types and
`getConversationId`).
