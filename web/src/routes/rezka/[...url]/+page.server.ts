import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { rawCachedPages } from '$lib/server/db/schema';
import { ilike, eq, or } from 'drizzle-orm';
import { extractRezkaDataFromHtml } from '$lib/server/rezka/extract';
import type { InputTypeForRezkaRouter } from '$lib/types/rezka';

export const load: PageServerLoad = async ({ params }): Promise<{ rezkaData: InputTypeForRezkaRouter }> => {
	const subpath = params.url || '';
	const fullUrl = `https://rezka.ag/${subpath.replace(/^\//, '')}`;

	// Only one single database query to raw_cached_pages table
	let cachedPages = await db
		.select({
			id: rawCachedPages.id,
			canonicalUrl: rawCachedPages.canonicalUrl,
			html: rawCachedPages.html
		})
		.from(rawCachedPages)
		.where(
			or(
				eq(rawCachedPages.canonicalUrl, fullUrl),
				ilike(rawCachedPages.canonicalUrl, `%${subpath}%`)
			)
		)
		.limit(1);

	if (cachedPages.length === 0) {
		// Fallback: take the first non-test cached page
		cachedPages = await db
			.select({
				id: rawCachedPages.id,
				canonicalUrl: rawCachedPages.canonicalUrl,
				html: rawCachedPages.html
			})
			.from(rawCachedPages)
			.where(ilike(rawCachedPages.canonicalUrl, '%rezka.ag%'))
			.limit(1);
	}

	if (cachedPages.length === 0) {
		throw error(404, `No cached page found for ${fullUrl}. Run scrape-rezka.ts first.`);
	}

	const rawPage = cachedPages[0];

	// Extract all metadata using happy-dom via shared extractor
	const rezkaData: InputTypeForRezkaRouter = extractRezkaDataFromHtml(rawPage.html, rawPage.canonicalUrl);

	return {
		rezkaData
	};
};
