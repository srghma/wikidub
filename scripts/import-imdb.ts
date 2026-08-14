import fs from 'fs';
import zlib from 'zlib';
import readline from 'readline';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://srghma@127.0.0.1:55432/rezka';
const sql = postgres(DATABASE_URL, { max: 10 });

const RATINGS_PATH = './imdb/title.ratings.tsv.gz';
const BASICS_PATH = './imdb/title.basics.tsv.gz';

const MIN_VOTES = 1000; // Filter popular titles as requested

async function readRatingsMap(): Promise<Map<string, { rating: string; votes: number }>> {
	console.log(`📊 Reading ratings from ${RATINGS_PATH} (filtering min votes >= ${MIN_VOTES})...`);
	const ratingsMap = new Map<string, { rating: string; votes: number }>();

	const fileStream = fs.createReadStream(RATINGS_PATH);
	const gunzip = zlib.createGunzip();
	const rl = readline.createInterface({
		input: fileStream.pipe(gunzip),
		crlfDelay: Infinity
	});

	let isFirst = true;
	let count = 0;

	for await (const line of rl) {
		if (isFirst) {
			isFirst = false;
			continue;
		}
		const parts = line.split('\t');
		if (parts.length >= 3) {
			const tconst = parts[0];
			const rating = parts[1];
			const votes = parseInt(parts[2], 10);
			if (!isNaN(votes) && votes >= MIN_VOTES) {
				ratingsMap.set(tconst, { rating, votes });
				count++;
			}
		}
	}

	console.log(`✓ Loaded ${count} rated titles into memory.`);
	return ratingsMap;
}

async function importBasics(ratingsMap: Map<string, { rating: string; votes: number }>) {
	console.log(`🎬 Reading basics from ${BASICS_PATH} and inserting into database...`);

	const fileStream = fs.createReadStream(BASICS_PATH);
	const gunzip = zlib.createGunzip();
	const rl = readline.createInterface({
		input: fileStream.pipe(gunzip),
		crlfDelay: Infinity
	});

	let isFirst = true;
	let processed = 0;
	let inserted = 0;

	const titleBatch: any[] = [];
	const genreBatch: any[] = [];
	const BATCH_SIZE = 1000;

	async function flushBatch() {
		if (titleBatch.length === 0) return;

		await sql`
			INSERT INTO imdb_titles ${sql(titleBatch, 'tconst', 'title_type', 'primary_title', 'original_title', 'is_adult', 'start_year', 'end_year', 'runtime_minutes', 'average_rating', 'num_votes')}
			ON CONFLICT (tconst) DO UPDATE SET
				title_type = EXCLUDED.title_type,
				primary_title = EXCLUDED.primary_title,
				original_title = EXCLUDED.original_title,
				is_adult = EXCLUDED.is_adult,
				start_year = EXCLUDED.start_year,
				end_year = EXCLUDED.end_year,
				runtime_minutes = EXCLUDED.runtime_minutes,
				average_rating = EXCLUDED.average_rating,
				num_votes = EXCLUDED.num_votes
		`;

		if (genreBatch.length > 0) {
			await sql`
				INSERT INTO imdb_title_genres ${sql(genreBatch, 'tconst', 'genre')}
				ON CONFLICT (tconst, genre) DO NOTHING
			`;
		}

		inserted += titleBatch.length;
		titleBatch.length = 0;
		genreBatch.length = 0;
		process.stdout.write(`\rInserted ${inserted} popular IMDb titles...`);
	}

	for await (const line of rl) {
		if (isFirst) {
			isFirst = false;
			continue;
		}

		processed++;
		const parts = line.split('\t');
		if (parts.length < 9) continue;

		const [tconst, titleType, primaryTitle, originalTitle, isAdultStr, startYearStr, endYearStr, runtimeStr, genresStr] = parts;

		// Only include popular titles that matched our ratings filter
		const ratingInfo = ratingsMap.get(tconst);
		if (!ratingInfo) continue;

		// Filter media types
		if (!['movie', 'tvSeries', 'tvMiniSeries', 'tvMovie'].includes(titleType)) continue;

		const isAdult = isAdultStr === '1';
		const startYear = startYearStr !== '\\N' ? parseInt(startYearStr, 10) : null;
		const endYear = endYearStr !== '\\N' ? parseInt(endYearStr, 10) : null;
		const runtimeMinutes = runtimeStr !== '\\N' ? parseInt(runtimeStr, 10) : null;
		const originalTitleClean = originalTitle !== '\\N' && originalTitle !== primaryTitle ? originalTitle.trim() : null;

		titleBatch.push({
			tconst,
			title_type: titleType,
			primary_title: primaryTitle.trim() || 'Untitled',
			original_title: originalTitleClean && originalTitleClean.length > 0 ? originalTitleClean : null,
			is_adult: isAdult,
			start_year: startYear && startYear >= 1800 && startYear <= 2100 ? startYear : null,
			end_year: endYear && endYear >= 1800 && endYear <= 2100 ? endYear : null,
			runtime_minutes: runtimeMinutes && runtimeMinutes > 0 ? runtimeMinutes : null,
			average_rating: ratingInfo.rating,
			num_votes: ratingInfo.votes
		});

		if (genresStr && genresStr !== '\\N') {
			const genres = genresStr.split(',').map(g => g.trim()).filter(g => g.length > 0);
			for (const g of genres) {
				genreBatch.push({ tconst, genre: g });
			}
		}

		if (titleBatch.length >= BATCH_SIZE) {
			await flushBatch();
		}
	}

	await flushBatch();
	console.log(`\n🎉 Finished importing IMDb! Total inserted: ${inserted} titles (from ${processed} scanned rows).`);
}

async function main() {
	console.log('🚀 Starting IMDb Import...');
	const ratingsMap = await readRatingsMap();
	await importBasics(ratingsMap);
	await sql.end({ timeout: 5 });
	process.exit(0);
}

main().catch((err) => {
	console.error('❌ IMDb import error:', err);
	process.exit(1);
});
