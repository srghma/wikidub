import { pgTable, serial, integer, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const task = pgTable('task', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

export const rawCachedPages = pgTable('raw_cached_pages', {
	id: serial('id').primaryKey(),
	canonicalUrl: text('canonical_url').notNull().unique(),
	html: text('html').notNull(),
	fetchedAt: timestamp('fetched_at').defaultNow().notNull()
});

export const rezkaMedia = pgTable('rezka_media', {
	id: serial('id').primaryKey(),
	canonicalUrl: text('canonical_url').notNull().unique(),
	titleRu: text('title_ru').notNull(),
	titleEn: text('title_en'),
	status: text('status'),
	quality: text('quality'),
	ratings: jsonb('ratings'),
	lists: jsonb('lists'),
	tagline: text('tagline'),
	releaseDate: text('release_date'),
	country: text('country'),
	directors: jsonb('directors'),
	genres: jsonb('genres'),
	ageRating: text('age_rating'),
	runtime: text('runtime'),
	collections: jsonb('collections'),
	cast: jsonb('cast'),
	synopsis: text('synopsis'),
	dubbings: jsonb('dubbings').notNull(), // array of { id, title, isOriginal, enabled }
	extractedAt: timestamp('extracted_at').defaultNow().notNull()
});

export const rezkaEpisodes = pgTable('rezka_episodes', {
	id: serial('id').primaryKey(),
	mediaCanonicalUrl: text('media_canonical_url').notNull(),
	translatorId: text('translator_id').notNull(),
	seasonId: text('season_id').notNull(),
	episodeId: text('episode_id').notNull(),
	seasonTitle: text('season_title'),
	episodeTitle: text('episode_title'),
	streams: jsonb('streams'), // { [quality]: { isPremContent, urlsArr } }
	subtitles: jsonb('subtitles') // array of { lang, url, code }
});

export const imdbTitles = pgTable('imdb_titles', {
	tconst: text('tconst').primaryKey(),
	titleType: text('title_type'),
	primaryTitle: text('primary_title').notNull(),
	originalTitle: text('original_title'),
	isAdult: integer('is_adult'),
	startYear: integer('start_year'),
	endYear: integer('end_year'),
	runtimeMinutes: integer('runtime_minutes'),
	genres: jsonb('genres'),
	averageRating: text('average_rating'),
	numVotes: integer('num_votes')
});

export * from './auth.schema';
