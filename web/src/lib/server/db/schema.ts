import { pgTable, serial, integer, text, timestamp, boolean, decimal } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const rawCachedPages = pgTable('raw_cached_pages', {
	id: serial('id').primaryKey(),
	canonicalUrl: text('canonical_url').notNull().unique(),
	html: text('html').notNull(),
	fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull()
});

export const rawCachedSubtitles = pgTable('raw_cached_subtitles', {
	id: serial('id').primaryKey(),
	url: text('url').notNull().unique(),
	vttContent: text('vtt_content').notNull(),
	fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull()
});

export const imdbTitles = pgTable('imdb_titles', {
	tconst: text('tconst').primaryKey(),
	titleType: text('title_type').notNull(),
	primaryTitle: text('primary_title').notNull(),
	originalTitle: text('original_title'),
	isAdult: boolean('is_adult').notNull().default(false),
	startYear: integer('start_year'),
	endYear: integer('end_year'),
	runtimeMinutes: integer('runtime_minutes'),
	averageRating: decimal('average_rating', { precision: 3, scale: 1 }),
	numVotes: integer('num_votes')
});

export const imdbTitleGenres = pgTable('imdb_title_genres', {
	id: serial('id').primaryKey(),
	tconst: text('tconst').notNull().references(() => imdbTitles.tconst, { onDelete: 'cascade' }),
	genre: text('genre').notNull()
});

export const imdbTitlesRelations = relations(imdbTitles, ({ many }) => ({
	genres: many(imdbTitleGenres)
}));

export * from './auth.schema';
