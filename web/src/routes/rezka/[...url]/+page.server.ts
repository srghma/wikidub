import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { rawCachedPages, imdbTitles, imdbTitleGenres } from '$lib/server/db/schema';
import { ilike, eq, or } from 'drizzle-orm';
import { extractRezkaDataFromHtml } from '$lib/server/rezka/extract';
import type { InputTypeForRezkaRouter, ImdbTitleRecord } from '$lib/types/rezka';

export const load = (async ({ params }) => {
	const subpath = params.url || '';
	const fullUrl = `https://rezka.ag/${subpath.replace(/^\//, '')}`;

	// 1. Single database query to raw_cached_pages table
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

	// 2. Extract metadata using happy-dom via shared extractor
	const rezkaData: InputTypeForRezkaRouter = extractRezkaDataFromHtml(rawPage.html, rawPage.canonicalUrl);

	// 3. Find matching title in local IMDb database (throw error if not found)
	const searchTitle = rezkaData.titleEn || rezkaData.titleRu;
	const imdbResults = await db
		.select()
		.from(imdbTitles)
		.where(
			or(
				ilike(imdbTitles.primaryTitle, searchTitle),
				ilike(imdbTitles.originalTitle, searchTitle)
			)
		)
		.limit(1);

	if (imdbResults.length === 0) {
		throw error(500, `IMDb title not found for "${searchTitle}". Our local IMDb database is expected to be complete.`);
	}

	const rawImdb = imdbResults[0];

	// 4. Query genres for this IMDb title
	const genreRows = await db
		.select({ genre: imdbTitleGenres.genre })
		.from(imdbTitleGenres)
		.where(eq(imdbTitleGenres.tconst, rawImdb.tconst));

	const imdbData: ImdbTitleRecord = {
		tconst: rawImdb.tconst,
		titleType: rawImdb.titleType,
		primaryTitle: rawImdb.primaryTitle,
		originalTitle: rawImdb.originalTitle,
		isAdult: rawImdb.isAdult,
		startYear: rawImdb.startYear,
		endYear: rawImdb.endYear,
		runtimeMinutes: rawImdb.runtimeMinutes,
		averageRating: rawImdb.averageRating,
		numVotes: rawImdb.numVotes,
		genres: genreRows.map((g) => g.genre)
	};

	return {
		rezkaData,
		imdbData
	};
}) satisfies PageServerLoad;
