import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user, userProfile } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';

/**
 * Dev-only test-data helper.
 *
 * Creates fake users — real rows in the better-auth DB — so you can test
 * with more than one account:
 *
 *   curl -X POST 'http://localhost:5173/dev/seed-users?count=5'
 *   curl -X POST 'http://localhost:5173/dev/seed-users?count=5&organizer=ada@commune.test'
 *
 * Re-runnable: existing emails are skipped. Returns 404 outside `npm run dev`.
 */

const TEST_PASSWORD = 'commune123';

const FIRST_NAMES =
[
	'Ada', 'Boris', 'Cleo', 'Dez', 'Erin',
	'Farid', 'Gina', 'Hugo', 'Isla', 'Jonas'
];

function seedIdentity(i: number): { name: string; email: string }
{
	const first = FIRST_NAMES[i % FIRST_NAMES.length];
	const cycle = Math.floor(i / FIRST_NAMES.length);
	const n = cycle + 1;

	return {
		name: cycle === 0 ? `${first} Test` : `${first} Test ${n}`,
		email: cycle === 0 ? `${first.toLowerCase()}@commune.test`
			: `${first.toLowerCase()}.${n}@commune.test`
	};
}

export const POST: RequestHandler = async ({ url }) =>
{
	// Hard gate: `import.meta.env.DEV` is replaced at build time, so this
	// endpoint is dead code (404) in production builds.
	if (!import.meta.env.DEV)
		return json({ error: 'Not available outside development' }, { status: 404 });

	const count = Math.min(
		20,
		Math.max(1, Number.parseInt(url.searchParams.get('count') ?? '5', 10) || 5));
	const organizerEmail = (url.searchParams.get('organizer') ?? '').toLowerCase();

	const created: Array<{ id: string; name: string; email: string; existed: boolean }> = [];
	const skipped: string[] = [];

	for (let i = 0; i < count; i++)
	{
		const { name, email } = seedIdentity(i);
		let existed = false;

		try
		{
			await auth.api.signUpEmail({
				body: { email, password: TEST_PASSWORD, name, callbackURL: '/' }
			});
		}
		catch (error)
		{
			if (error instanceof APIError)
			{
				existed = true; // re-runnable: skip users that are already there
			}
			else
			{
				throw error;
			}
		}

		const rows = await db
			.select({ id: user.id, name: user.name })
			.from(user)
			.where(eq(user.email, email))
			.limit(1);

		if (rows.length === 0)
			throw new Error(`User row for ${email} not found after signup`);

		created.push({ id: rows[0].id, name: rows[0].name ?? name, email, existed });

		if (existed)
			skipped.push(email);
	}

	// Dev shortcut for the event_organizer flag (normally only set by
	// Commune admin tooling in P1 #6).
	if (organizerEmail)
	{
		const org = await db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.email, organizerEmail))
			.limit(1);

		if (org.length > 0)
			await db
				.insert(userProfile)
				.values({ userId: org[0].id, isEventOrganizer: 1 })
				.onConflictDoUpdate({
					target: userProfile.userId,
					set: { isEventOrganizer: 1 }
				});
	}

	return json({ created, skipped, password: TEST_PASSWORD });
};
