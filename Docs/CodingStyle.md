# Commune Coding Style

This document describes the coding style used across the **Commune** project
(`Commune/` — SvelteKit 5 + TypeScript + Svelte 5 runes). It was derived by
analyzing the hand-written source files, most notably:

- `src/routes/+page.svelte`
- `src/lib/components/ChatWindow.svelte`
- `src/lib/components/MapView.svelte`, `UserMarkerLayer.svelte`
- `src/lib/actions/ClickOutside.ts`
- `src/lib/data/chat.ts`, `src/lib/data/fakeUsers.ts`
- `src/lib/server/db/ChatDB.ts`, `schema.ts`, `index.ts`
- `src/routes/api/chat/+server.ts`, `src/hooks.server.ts`
- `src/routes/demo/better-auth/**`
- `vite.config.ts`, `drizzle.config.ts`, `eslint.config.js`

The style is **Allman-based** (opening braces on their own line), with two
characteristic deviations that define its voice:

1. **Single-statement `if` / `for` / `while` are written without braces.**
2. **`return` statements are visually separated** from surrounding code with
   blank lines, so guard clauses and function exits are easy to scan.

> Nothing about this style is currently enforced by tooling (see
> [Tooling](#15-tooling)). The style guide is the source of truth. Known
> deviations in legacy/generated files are listed in
> [Exceptions & legacy code](#14-exceptions--legacy-code).

---

## 1. Quick reference

| Concern | Rule |
|---|---|
| Indentation | **Tabs**, one level per block (no spaces, ever) |
| Braces (blocks) | **Allman**: `{` on its own line, **aligned with the line that opens the block** |
| Braces (multi-line values) | Same Allman placement as blocks |
| Single-statement control flow | **No braces**, body on the next line, indented one level deeper |
| Multi-statement control flow | Braces (Allman) |
| `return` | Isolated by blank lines from other statements |
| Semicolons | Always |
| String quotes | Single quotes `'` (backticks for interpolation) |
| Trailing commas | **None** on the last property/element of a multi-line object/array |
| Spacing | Spaces around binary operators and `=`; space after `,`; no space inside parens |
| Constants | `UPPER_SNAKE_CASE` |
| Functions / props / locals | `camelCase` |
| Types / components | `PascalCase` |
| Event handlers (local) | `handleX` |
| Callback props | `onX` |
| Section banners | `/* ── Title ─────────────── */` |
| Line endings / EOF | No trailing whitespace, one trailing newline |
| Svelte | Runes only (`$state`, `$derived`, `$effect`, `$props`) |

---

## 2. Indentation

- **Tabs** for all indentation, in `<script>`, markup, and `<style>`.
- One tab per nesting level. No mixing of tabs and spaces inside a file.
- Continuation lines (wrapped arguments, method chains, ternary branches,
  multi-line signature parameters) are indented **one level deeper than the
  statement that starts them** — not aligned to the opening token.

```ts
// from src/lib/server/db/ChatDB.ts
	const rows = await db
		.select()
		.from(chatMessage)
		.where(eq(chatMessage.conversationId, conversationId))
		.orderBy(asc(chatMessage.sentAt));
```

The only space-indented code in the hand-written codebase is the generated
`auth.schema.ts` (see exceptions) and one legacy `input:focus` CSS block in
`ChatWindow.svelte`.

---

## 3. Brace style: Allman

The **opening brace always goes on its own line**, aligned with the line that
introduces the block (the function declaration, the line containing `=>`, the
control statement, or the statement whose value it opens). The body is
indented one level deeper than the brace; the closing brace aligns with the
opening brace.

This applies uniformly to:

- function declarations
- arrow function bodies (top-level exports, Svelte lifecycle callbacks,
  inline event callbacks, IIFEs, cleanup `return () => { … }`)
- `if` / `for` / `while` blocks (multi-statement bodies)
- `try` / `catch`
- multi-line object/array literals and object *types*

```ts
// Function declaration — from src/routes/+page.svelte
	function handleMapReady(readyMap: maplibregl.Map)
	{
		map = readyMap;
	}

// Svelte effect — from src/routes/+page.svelte
	$effect(() =>
	{
		if (!map || !selectedUser)
			return;

		const currentMap = map;
		const handleResize = () => queueChatCentering(true);
		currentMap.on('resize', handleResize);

		return () => currentMap.off('resize', handleResize);
	});

// Top-level arrow assignment — from src/routes/api/chat/+server.ts
export const GET: RequestHandler = async ({ url }) =>
{
	const conversationId = url.searchParams.get('conversationId');

	if (!conversationId)
		return json({ error: 'conversationId is required' }, { status: 400 });

	const messages = await loadConversation(conversationId);

	return json(messages);
};

// Inline callback as a function argument — from src/lib/components/UserMarkerLayer.svelte
			element.addEventListener('click', (event) =>
			{
				event.stopPropagation();
				onUserSelect(user);
			});

// Method shorthand inside a returned object — from src/lib/actions/ClickOutside.ts
	return {
		destroy()
		{
			document.removeEventListener('pointerdown', handleClick, true);
		},
		update(newCallback: () => void)
		{
			callback = newCallback;
		}
	};
```

Note the consistent alignment: in every example above the `{` sits at the
**same indent as the line above it**, never one level deeper. This is the
signature of the project's Allman variant (compared with classic Allman,
where `{` is often indented under the declaration).

### 3.1 Multi-line values use the same placement

When an object literal, array, or type object is written across multiple
lines, its opening `{`/`[` goes on the next line, aligned with the statement
that introduces it (`=`, `(`, `,`), and members are indented one level:

```ts
// from src/routes/+page.svelte
	const message: ChatMessage =
	{
		id: messageId,
		senderId: testClient.id,
		recipientId: selectedUser.id,
		text,
		sentAt: new Intl.DateTimeFormat('en',
		{
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date())
	};

// Argument object — from src/lib/components/ChatWindow.svelte
		onGeometryChange?.(
		{
			contactId: contact.id,
			version: geometryVersion,
			center: {
				x: chatRect.left - mapRect.left + chatRect.width / 2,
				y: chatRect.top - mapRect.top + chatRect.height / 2
			},
			size: {
				width: chatRect.width,
				height: chatRect.height
			}
		});

// Array value — from src/lib/components/ChatWindow.svelte
		const events: Array<keyof maplibregl.MapEventType> =
		[
			'move',
			'zoom',
			'rotate',
			'pitch',
			'resize'
		];

// Function parameter with an object type — from src/lib/server/db/ChatDB.ts
export async function saveMessage(payload:
{
	id: string;
	conversationId: string;
	senderId: string;
	recipientId: string;
	text: string;
	sentAt: string;
}): Promise<void>
{
```

### 3.2 When `= {` stays on one line

Small, flat *data* objects (especially in data modules) may keep the opening
brace inline after `=`. This form appears in `chat.ts`, `fakeUsers.ts`,
`ClickOutside.ts` (`return {`), and config files (`defineConfig({`). When in
doubt, prefer the Allman placement for anything nested or non-trivial — that
is the dominant form in the application code.

```ts
// from src/lib/data/chat.ts (inline form, data file)
export type ChatMessage = {
	id: string;
	senderId: string;
	recipientId: string;
	text: string;
	sentAt: string;
};
```

### 3.3 Arrow bodies that are a single object

When an arrow's body is a single object literal, the `=>` ends the line and
the next line starts with `({` (paren + brace together), aligned with the
statement line:

```ts
// from src/lib/server/db/ChatDB.ts
	return rows.map((row) =>
	({
		id: row.id,
		senderId: row.senderId,
		recipientId: row.recipientId,
		text: row.text,
		sentAt: row.sentAt
	}));
```

### 3.4 Single-expression arrow bodies stay inline

Arrows whose body is one short expression do **not** get braces at all:

```ts
	const handleResize = () => queueChatCentering(true);
	easing: (easingProgress) => easingProgress * (2 - easingProgress)
	.catch((err) => console.error('Failed to save message', err))
	use:clickOutside={() => (contact = null)}
```

---

## 4. Control flow: brace-less single statements

This is the style's most distinctive rule.

- If an `if`, `for`, or `while` body is **exactly one statement**, write it
  **without braces**. The statement goes on the **next line**, indented one
  level deeper than the control line. Never on the same line.
- If the body has **two or more statements**, use braces (Allman).

```ts
// Single statement — no braces. From src/lib/components/ChatWindow.svelte
		if (!map || !contact)
		{
			onGeometryChange?.(null);   // ← two statements → braces required
			return;
		}

		if (typeof window === 'undefined')
			return;

		for (const eventName of events)
			map.on(eventName, updatePosition);

// Guard clause — no braces. From src/routes/+page.svelte
	function centerOnChatWindow()
	{
		if (!map || !selectedUser || !chatWindowGeometry)
			return;

		map.easeTo(/* … */);
	}

// try / catch — from src/routes/+page.svelte
			try
			{
				await tick();
			}
			catch
			{
				return;
			}
```

Rules of thumb:

- `catch` omits its binding (`catch`) when the error is unused; use
  `catch (err)` only when it is referenced (e.g. `console.warn(…, err)`).
- There is **no** same-line `if (cond) doThing();` anywhere in the codebase.
- The one-line-per-statement form keeps the "early exit" rhythm visible in
  code review.

A handful of older spots still wrap a single statement in braces
(`if (map) { … }` in `MapView.svelte`, `if (!currentMap) { return; }` in
`UserMarkerLayer.svelte`, `ClickOutside.ts`). These are legacy, not the
norm — new code omits the braces.

---

## 5. `return` statements: isolated for clarity

`return` statements are set apart from other code with **blank lines**, so
the exit points of a function read as their own visual unit:

- A **guard-clause return** (brace-less `if (…) return …;`) is followed by a
  blank line before the function's main body.
- A **final return** is preceded by a blank line when it is not immediately
  part of a tiny guard/default pair.

```ts
// From src/routes/api/chat/+server.ts
export const GET: RequestHandler = async ({ url }) =>
{
	const conversationId = url.searchParams.get('conversationId');

	if (!conversationId)
		return json({ error: 'conversationId is required' }, { status: 400 });

	const messages = await loadConversation(conversationId);

	return json(messages);
};

// From src/routes/+page.svelte
	function getSelectedUserGeometryVersion()
	{
		if (!selectedUser || !chatWindowGeometry)
			return 0;

		if (chatWindowGeometry.contactId !== selectedUser.id)
			return 0;

		return chatWindowGeometry.version;
	}
```

Accepted compact exception: in a 2–3 line function where a guard return is
immediately followed by the default return, the blank line may be omitted:

```ts
// From src/routes/demo/better-auth/login/+page.server.ts
export const load: PageServerLoad = (event) =>
{
	if (event.locals.user)
		return redirect(302, '/demo/better-auth');
	return {};
};
```

A `return` that is the *entire* body of a one-liner helper is naturally
unseparated:

```ts
	const handleResize = () => queueChatCentering(true);
```

---

## 6. Blank lines and logical grouping

Blank lines separate **logical sections**, not every statement.

- One blank line between top-level declarations in a file
  (imports block → constants → types → state → derived → effects → functions).
- One blank line between functions.
- Blank line before a section banner comment (see §11.1).
- Blank line after a guard clause and before the main body (see §5).
- Blank line before a final `return` (see §5).
- Consecutive statements of the *same* logical step may stay together without
  blank lines:

```ts
// From src/lib/components/ChatWindow.svelte
	function handleSubmit()
	{
		const text = draft.trim();

		if (!text)
			return;

		onSend(text);     // ← two statements of one step: no blank line
		draft = '';
	}

// From src/routes/+page.svelte — state declarations grouped, no blank lines
	let map = $state<maplibregl.Map | null>(null);
	let selectedUser = $state<MapUser | null>(null);
	let conversations = $state<ConversationMessages>({});
	let chatWindowGeometry = $state<ChatWindowGeometry | null>(null);
	let centerChatRequest = $state(0);
	let requestedGeometryVersion = $state(0);
```

- Svelte files use one blank line between the top-level blocks
  (`</script>` → markup → `<style>`), and between template siblings such as
  `</svelte:head>` and the page `<section>`.

---

## 7. Statements, quotes, punctuation

- **Semicolons** terminate every statement. No exceptions.
- **Single quotes** for all string literals. Backticks only when
  interpolating: `` `Failed to load conversation ${conversationId}` ``.
- **No trailing comma** on the last property/element of a multi-line
  object, array, or argument list. (Commas separate items; the final item is
  unadorned.) The sole historical exception is the actions object in
  `routes/demo/better-auth/login/+page.server.ts`.
- **Spacing**:
  - space after commas in argument lists and collections:
    `json({ error: '…' }, { status: 400 })`, `['move', 'zoom']`
  - spaces around binary operators and assignment:
    `geometryVersion += 1;`, `x: chatRect.left - mapRect.left + chatRect.width / 2`
  - no space after `(` or before `)` in calls:
    `map.unproject([x, y])`, `fetch(url)`
  - no space after unary `!`: `if (!map || !selectedUser)`
  - object members: `key: value` (space after colon), shorthand `text,`
    when key and value match.
- **No trailing whitespace** at end of lines. One trailing newline at EOF.

---

## 8. Multi-line expressions

### 8.1 Function calls with several arguments

When an argument list wraps, each argument goes on its own line, indented one
level from the statement line:

```ts
// from src/lib/components/MapView.svelte
		map = new maplibregl.Map(
		{
			container,
			style: styleJson as unknown as StyleSpecification,
			center: [0, 0],
			zoom: 2
		});
```

### 8.2 Method chains

Chain calls are written one per line, indented one level from the statement:

```ts
// from src/lib/server/db/ChatDB.ts
	const rows = await db
		.select()
		.from(chatMessage)
		.where(eq(chatMessage.conversationId, conversationId))
		.orderBy(asc(chatMessage.sentAt));
```

### 8.3 Ternaries

A ternary that does not fit comfortably on one line puts each branch on its
own line, indented one level from the assignment:

```ts
// from src/routes/+page.svelte
		requestedGeometryVersion = requireFreshGeometry
			? currentGeometryVersion + 1
			: currentGeometryVersion;
```

Short ternaries stay inline:
`filename.split(/[/\\]/).includes('node_modules') ? undefined : true`.

### 8.4 Chained boolean expressions

`&&`/`||` continuations put the operator at the **end** of the line and
indent the continuation:

```ts
// from src/routes/+page.svelte
	function canCenterSelectedChat()
	{
		return Boolean(
			centerChatRequest &&
			selectedUser &&
			chatWindowGeometry &&
			chatWindowGeometry.contactId === selectedUser.id &&
			chatWindowGeometry.version >= requestedGeometryVersion
		);
	}
```

### 8.5 Long signatures

Parameters wrap one per line, indented one level; the closing `): ReturnType`
gets its own line, followed by the Allman block brace:

```ts
// from src/lib/server/db/ChatDB.ts
export async function loadConversation(
	conversationId: string
): Promise<ChatMessage[]>
{
```

### 8.6 Async IIFEs

Used for fire-and-forget async work inside effects; same brace rules apply:

```ts
// from src/routes/+page.svelte
		(async () =>
		{
			try
			{
				await tick();
			}
			catch
			{
				return;
			}

			if (centerChatRequest !== requestId || !canCenterSelectedChat())
				return;

			centerChatRequest = 0;
			centerOnChatWindow();
		})();
```

---

## 9. Naming conventions

| Kind | Convention | Examples |
|---|---|---|
| Module-level constants | `UPPER_SNAKE_CASE` | `CHAT_CENTER_DURATION_MS` |
| Functions | `camelCase` verbs | `queueChatCentering`, `reportGeometry` |
| Local event handlers | `handle` prefix | `handleMapReady`, `handleSubmit`, `handleUserSelect` |
| Callback props / events | `on` prefix | `onClose`, `onSend`, `onMapReady`, `onUserSelect` |
| Types / interfaces | `PascalCase` | `ChatMessage`, `MapUser`, `ConversationMessages`, `ChatWindowGeometry` |
| Components (files) | `PascalCase.svelte` | `ChatWindow.svelte`, `UserMarkerLayer.svelte` |
| Lib modules | `PascalCase.ts` for capabilities, `camelCase.ts` for data | `ClickOutside.ts`, `ChatDB.ts`, `chat.ts`, `fakeUsers.ts` |
| State variables | `camelCase`, descriptive | `chatWindowGeometry`, `requestedGeometryVersion` |
| DB tables (drizzle) | `camelCase` const → snake_case table name | `chatMessage` → `'chatMessage'` |
| CSS classes | `kebab-case` | `.chat-window`, `.message-row`, `.close-button`, `.sr-only` |

- Props mirror their consumer: `bind:this={chatWindowElement}` uses
  `element` suffix for DOM refs (`chatWindowElement`, `container`).
- DOM event callbacks receive `event` as their parameter name.
- Boolean-ish checks prefer negated guard clauses (`if (!selectedUser)`).

---

## 10. TypeScript conventions

- **Explicit types over inference** at every public boundary:
  - Svelte state: `let map = $state<maplibregl.Map | null>(null);`
  - Props: `let { … } = $props<{ … }>();` (see §11.2)
  - Exported functions carry return types:
    `: Promise<ChatMessage[]>`, `: Promise<void>`, `: void`, `: string`
  - Arrays typed explicitly when meaningful:
    `const events: Array<keyof maplibregl.MapEventType> = […]`
- Nullability is made visible in types (`| null`, `?` for optional props).
- Optional call for possibly-undefined callbacks: `onGeometryChange?.(null)`.
- Nullish coalescing for fallbacks: `conversations[conversationId] ?? []`,
  `formData.get('email')?.toString() ?? ''`.
- Type aliases (`type`) are used instead of `interface` in this codebase.
- `type` imports are mixed into value import lists where convenient:
  `import { fakeUsers, testClient, type MapUser } from '…'`.
- `as` casts are used sparingly and with a comment-free but obvious target:
  `styleJson as unknown as StyleSpecification`.
- Runes-mode code uses `declare`-free style; `app.d.ts` extends `App.Locals`
  for server-side auth state.

### 10.1 Imports

One import per line. Groups separated by blank lines, in this order:

1. Framework (`svelte`, `@sveltejs/kit`, third-party packages)
2. Local `$lib` **components**
3. Local `$lib` **data / types**
4. Local `$lib` **actions** / relative assets

```ts
// From src/routes/+page.svelte
	import { tick, onMount } from 'svelte';
	import type maplibregl from 'maplibre-gl';

	import ChatWindow from '$lib/components/ChatWindow.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import UserMarkerLayer from '$lib/components/UserMarkerLayer.svelte';

	import
	{
		getConversationId,
		type ChatMessage,
		type ConversationMessages
	} from '$lib/data/chat';

	import { fakeUsers, testClient, type MapUser } from '$lib/data/fakeUsers';
```

- Short named-import lists stay inline: `import { tick, onMount } from 'svelte';`
- Longer or mixed value/type lists expand with the house brace rule —
  `import` line, `{` line, one specifier per line, `} from '…';` line:

```ts
	import
	{
		getConversationId,
		type ChatMessage,
		type ConversationMessages
	} from '$lib/data/chat';
```

- Side-effect imports (CSS) go with the local group:
  `import 'maplibre-gl/dist/maplibre-gl.css';`

---

## 11. Svelte conventions

### 11.1 File skeleton

```
<script lang="ts">
	…
</script>

<markup>

<style>
	…
</style>
```

- `<script lang="ts">` is always first; a blank line separates it from the
  markup, and the markup from `<style>`.
- Inside `<script>`, the declaration order is:
  **imports → constants → types → `$state` declarations → `$derived` →
  lifecycle hooks (`onMount`/`onDestroy`) → section-bannered functions →
  `$effect` blocks** (effects tend to sit near what they observe).
- `<svelte:head>` holds `<title>` and `<meta>` in route pages.

### 11.2 Props

Destructured `$props` with a type argument use the multi-line form, one prop
per line, no trailing comma:

```ts
// from src/lib/components/ChatWindow.svelte
	let {
		map,
		client,
		contact,
		messages,
		onClose,
		onSend,
		onGeometryChange
	} = $props<{
		map: maplibregl.Map | null;
		client: MapUser;
		contact: MapUser | null;
		messages: ChatMessage[];
		onClose: () => void;
		onSend: (text: string) => void;
		onGeometryChange?: (geometry: {
			contactId: string;
			version: number;
			center: { x: number; y: number };
			size: { width: number; height: number };
		} | null) => void;
	}>();
```

Trivial/untyped props stay inline: `let { children } = $props();`.

### 11.3 Runes

- `$state<T>(initial)` for reactive state (typed when the type is non-obvious).
- `$derived.by(() => { … })` for computed values with logic; the callback body
  follows the normal brace/return rules (guard clause first).
- `$effect(() => { … })` for side effects; effects that subscribe to external
  systems (`map.on`, `ResizeObserver`, `requestAnimationFrame`) **return a
  cleanup function** using the `return () => { … };` Allman form.
- `$props()` for props (never `export let`).
- Runes mode is forced project-wide in `vite.config.ts`.

### 11.4 Markup

- Tab indentation in templates, one level per nesting; block tags
  (`{#if}`, `{#each}`) indented like any other element.
- Elements with **multiple attributes** list one attribute per line; the
  closing `>` or `/>` sits on its own line aligned with the tag. Single- or
  zero-attribute elements stay on one line:

```svelte
		<ChatWindow
			{map}
			client={testClient}
			contact={selectedUser}
			messages={selectedMessages}
			onGeometryChange={handleChatWindowGeometryChange}
			onClose={closeChat}
			onSend={sendMessage}
		/>

		<MapView onMapReady={handleMapReady} />
```

- Shorthand spread `{propName}` is preferred when prop and variable match.
- Event handlers in markup: `onclick={onClose}` (property name, no quotes).
  Inline handlers that need multiple statements expand with the house rule:

```svelte
		<form onsubmit={(event) =>
		{
			event.preventDefault();
			handleSubmit();
		}}>
```

- Buttons always declare `type` (`type="button"` / `type="submit"`).
- Icon-like buttons (`×`) carry a descriptive `aria-label`.
- Accessibility is part of the house style: `aria-live="polite"` on message
  lists, `role="dialog" aria-modal="true"` on popups, `.sr-only` labels for
  form inputs, `:focus-visible` styles instead of removing focus outlines.
- Void elements self-close: `<input … />`, `<meta … />`, `<link … />`.

### 11.5 CSS (`<style>` blocks)

- **Allman selectors**: selector on its own line, `{` on its own line aligned
  with the selector, declarations indented one level:

```css
	.chat-window
	{
		position: absolute;
		z-index: 10;
		width: min(22rem, calc(100% - 2rem));
	}

	@media (max-width: 40rem)
	{
		.chat-window
		{
			width: min(20rem, calc(100% - 1rem));
		}
	}
```

- One declaration per line, `property: value;` (space after the colon).
- Grouped selectors: one selector per line:

```css
	:global(button.user-dot:hover),
	:global(button.user-dot:focus-visible)
	{
		…
	}
```

- Element selectors that must reach the DOM are wrapped in `:global(…)`.
- Units: `rem` for sizes/spacing, `px` only for 1px rules and small pixel
  values (e.g. marker `18px`), `%`/`calc()`/`min()` where fluid.
- Colors: `#hex` for opaque, `rgba(…)` for translucent; shadows written with
  explicit spread values: `box-shadow: 0 1rem 3rem rgba(10, 29, 56, 0.28);`
- Multi-value properties (e.g. stacked `box-shadow`) wrap one value per line,
  indented one level.
- Pseudo-elements use `::` (`.chat-window::after`); pseudo-classes single `:`.
- Standard properties come before vendor prefixes
  (`appearance: none;` then `-webkit-appearance: none;`).
- Scoped styles only; no global CSS files (the only `:global` usage is
  per-component).

---

## 12. Comments

### 12.1 Section banners

Logical sections inside a file are introduced by a banner comment built with
box-drawing dashes, padded to a fixed visual width:

```ts
	/* ── Load persisted conversations on mount ─────────────────── */

	/* ── Map / chat wiring ─────────────────────────────────────── */

	/* ── Map resize handler ────────────────────────────────────── */
```

A blank line precedes each banner. They appear in `.svelte` script blocks and
in schema files (e.g. `/* ── Chat messages ─── … */` in `schema.ts`).

### 12.2 Inline `//` comments

Used to explain **why**, especially non-obvious behavior. Multiple consecutive
`//` lines are used for a single extended explanation (not block comments for
prose):

```ts
	// Use capture + pointerdown so this fires before marker click handlers
	// finish, but since it only checks "outside this node", clicking a
	// marker (which is outside the ChatWindow) will still correctly close it
	// AND still let the marker's own click handler run afterwards.
```

### 12.3 JSDoc

Exported library functions that are not self-evident get a one-line JSDoc:

```ts
/**
 * Load all messages for a single conversation (user pair).
 */
export async function loadConversation(…): Promise<ChatMessage[]>
```

### 12.4 Commented-out code

Prototype-phase scaffolding may be commented out in place
(`//let loading = $state(true);`, `//loading = false;`) — clean up on the
iteration that re-enables it.

---

## 13. Error handling

- **Startup/config validation** throws immediately, brace-less:

```ts
// from src/lib/server/db/index.ts
if (!env.DATABASE_URL)
	throw new Error('DATABASE_URL is not set');
```

- **Expected async failures** (fetches, DB ops) are wrapped in Allman
  `try`/`catch`; the catch logs with `console.warn`/`console.error` and the
  error value when useful:

```ts
			try
			{
				const res = await fetch(…);
				all[conversationId] = await res.json();
			}
			catch (err)
			{
				console.warn(`Failed to load conversation ${conversationId}`, err);
			}
```

- **API endpoints** answer errors as JSON with an explicit status, using the
  guard-return idiom (§4 + §5).
- `.catch((err) => console.error(…))` is used for fire-and-forget POSTs where
  a failure must not break the UI.
- No `try/finally` and no custom error classes in the current codebase.

---

## 14. Exceptions & legacy code

Files that do **not** follow this style — do not "fix" them casually and do
not use them as reference examples:

| File | Why it differs |
|---|---|
| `src/lib/server/db/auth.schema.ts` | **Generated** by better-auth (`npm run auth:schema`). Prettier style: 2-space indent, double quotes, trailing commas. Regenerate, never hand-edit. |
| `src/lib/components/UserPopup.svelte` | CSS uses K&R one-line selectors (`.overlay {`). Superseded by the ChatWindow flow; rework to this style if it is touched again. |
| `ChatWindow.svelte` → `input:focus` block | Indented with spaces; an accidental legacy block. Normalize to tabs/Allman when editing. |
| `src/lib/data/chat.ts`, `fakeUsers.ts` | Use inline `= {` for flat data objects (accepted compact form, §3.2). |
| `routes/demo/better-auth/login/+page.server.ts` | One trailing comma before a closing `}`; compact guard/default return pair. |
| `src/lib/server/db/ChatDB.ts` | One line with trailing whitespace (`rows.map((row) => `). |

If a file predates this style and you are already editing a region, match the
house style in the **touched** lines; don't reformat untouched code.

---

## 15. Tooling

- **ESLint** (`eslint.config.js`): flat config with `@eslint/js` recommended,
  `typescript-eslint` recommended, `eslint-plugin-svelte` recommended,
  `no-undef` off (per typescript-eslint guidance). **No stylistic rules are
  configured** — the style above is not lint-enforced.
- **No Prettier** anywhere in the repo; do not introduce it without
  converting it to these rules (Prettier's defaults — K&R braces, spaces,
  trailing commas — conflict with this style).
- **No `.editorconfig`**. Suggested addition so editors don't fight the style:

```ini
# .editorconfig (suggested, not yet present in the repo)
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = tab
indent_size = 1
tab_width = 4

[*.{js,ts,svelte,json,css,md}]
indent_style = tab
```

- Suggested follow-up (future task, not currently enabled): the closest
  stock ESLint rules are
  - `curly: ['error', 'multi-or-nest', 'no-single-statement']` — enforces
    braces for multi-statement bodies while permitting the brace-less
    single-statement form;
  - `brace-style: ['error', 'allman']` — enforces opening braces on their
    own line (it does **not** enforce the exact alignment/indent of the
    brace, so the "aligned with the statement" detail remains a review
    concern);
  - `indent: ['error', 'tab', { … }]` — could enforce tab indentation and
    continuation-line offsets, at the cost of the `indent` rule's
    complexity and poor Svelte-template coverage.
- Verification commands: `npm run check` (svelte-check) and `npm run lint`.

---

## 16. Pre-commit checklist (new code)

1. Tabs only; continuation lines one level deeper than the statement.
2. Every `{` on its own line, aligned with the line that opens the block;
   multi-line objects/arrays use the same placement.
3. Single-statement `if`/`for`/`while` → no braces, body on next line.
   Two+ statements → braces.
4. Guard clauses and final `return`s isolated with blank lines.
5. Semicolons everywhere; single quotes; no trailing comma on the last
   member of a wrapped collection.
6. `UPPER_SNAKE` constants, `camelCase` functions, `handle*`/`on*` for
   events, `PascalCase` types and components.
7. Explicit types on state, props, and exported function signatures.
8. Imports grouped (framework → components → data → actions), one per line.
9. Svelte: runes only; multi-attribute elements one attribute per line with
   `/>` on its own line; buttons have `type`; a11y attributes present.
10. CSS: Allman selectors, `:global()` where needed, rem-first units.
11. Section banners for logical chunks; comments explain *why*.
12. No trailing whitespace; `npm run check` and `npm run lint` pass.

---

*Derived from the Commune codebase on 2026-09-03. When the codebase and this
document disagree, update this document in the same change.*
