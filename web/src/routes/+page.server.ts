import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { imdbTitles, imdbTitleGenres } from '$lib/server/db/schema';
import { desc, sql, eq, ilike, and, inArray } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url }) => {
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
	const limit = 30;
	const offset = (page - 1) * limit;
	const search = url.searchParams.get('q')?.trim() || '';
	const type = url.searchParams.get('type') || 'all';
	const genre = url.searchParams.get('genre') || '';

	const conditions = [];

	if (search) {
		conditions.push(ilike(imdbTitles.primaryTitle, `%${search}%`));
	}

	if (type !== 'all') {
		conditions.push(eq(imdbTitles.titleType, type));
	}

	let titlesQuery = db
		.select({
			tconst: imdbTitles.tconst,
			titleType: imdbTitles.titleType,
			primaryTitle: imdbTitles.primaryTitle,
			originalTitle: imdbTitles.originalTitle,
			startYear: imdbTitles.startYear,
			endYear: imdbTitles.endYear,
			runtimeMinutes: imdbTitles.runtimeMinutes,
			averageRating: imdbTitles.averageRating,
			numVotes: imdbTitles.numVotes
		})
		.from(imdbTitles);

	if (conditions.length > 0) {
		titlesQuery = titlesQuery.where(and(...conditions)) as any;
	}

	const titles = await titlesQuery
		.orderBy(desc(imdbTitles.numVotes))
		.limit(limit)
		.offset(offset);

	// Fetch genres for these titles
	const tconsts = titles.map(t => t.tconst);
	let genreMap: Record<string, string[]> = {};
	
	if (tconsts.length > 0) {
		const genresList = await db
			.select({
				tconst: imdbTitleGenres.tconst,
				genre: imdbTitleGenres.genre
			})
			.from(imdbTitleGenres)
			.where(inArray(imdbTitleGenres.tconst, tconsts));

		for (const item of genresList) {
			if (!genreMap[item.tconst]) genreMap[item.tconst] = [];
			genreMap[item.tconst].push(item.genre);
		}
	}

	const formattedTitles = titles.map(t => ({
		...t,
		genres: genreMap[t.tconst] || []
	}));

	// Get total count estimate
	const [countResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(imdbTitles)
		.where(conditions.length > 0 ? and(...conditions) : sql`1=1`);

	return {
		titles: formattedTitles,
		totalCount: Number(countResult?.count || 0),
		page,
		limit,
		search,
		type,
		genre
	};
};
