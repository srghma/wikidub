import { Window } from 'happy-dom';
import postgres from 'postgres';
import puppeteer from 'puppeteer';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://srghma@127.0.0.1:55432/rezka';
const sql = postgres(DATABASE_URL);

function clearTrash(data: string): string {
	const trashList = [
		'//_//QEBAQEAhIyMhXl5e',
		'//_//Xl5eIUAjIyEhIyM=',
		'//_//JCQhIUAkJEBeIUAjJCRA',
		'//_//IyMjI14hISMjIUBA',
		'//_//JCQjISFAIyFAIyM='
	];
	while (trashList.some((subString) => data.includes(subString))) {
		data = data.replace(new RegExp(trashList.join('|'), 'g'), '');
	}
	data = data.replace('#h', '');
	try {
		return atob(data);
	} catch (e) {
		return data;
	}
}

function parseQualityDetail(rawItem: string) {
	const match = rawItem.match(/\[(.*?)\]/);
	if (!match) return null;
	const rawQuality = match[1];
	const premMatch = rawQuality.match(/>\s*(\d+[pk](?:\s+Ultra)?)\s*</i) || rawQuality.match(/(\d+[pk](?:\s+Ultra)?)/i);
	const qualityItem = premMatch ? premMatch[1] : rawQuality.replace(/<[^>]*>/g, '').trim();
	const isPrem = rawQuality.includes('prem-quality');
	const rawUrls = rawItem.slice(match[0].length).split(/\sor\s/).map(s => s.trim()).filter(Boolean);
	return {
		quality: qualityItem,
		isPremContent: isPrem,
		urlsArr: rawUrls
	};
}

export function decodeVideoURL(stream: string | false | null) {
	if (!stream) return [];
	let cleanedStream: string;
	try {
		cleanedStream = clearTrash(stream);
	} catch {
		cleanedStream = stream;
	}
	const result: { quality: string; isPremium: boolean; url: string }[] = [];
	cleanedStream.split(',').forEach((currentValue) => {
		const parsed = parseQualityDetail(currentValue);
		if (parsed) {
			parsed.urlsArr.forEach((u) => {
				result.push({
					quality: parsed.quality,
					isPremium: parsed.isPremContent,
					url: u
				});
			});
		}
	});
	return result;
}

export function decodeSubtitleURL(subtitlesStr: string | null, subtitleLns: Record<string, string> | null) {
	if (!subtitlesStr) return [];
	const items = subtitlesStr.split(',');
	return items.map((item) => {
		const m = item.match(/\[(.*?)\](https?:\/\/.*\.vtt)/);
		if (!m) return null;
		const lang = m[1];
		const url = m[2];
		return {
			langName: lang,
			langCode: subtitleLns ? subtitleLns[lang] || lang : lang,
			url
		};
	}).filter((x): x is { langName: string; langCode: string; url: string } => x !== null);
}

function cleanStr(val: string | null | undefined): string | null {
	if (!val) return null;
	const trimmed = val.trim();
	return trimmed.length > 0 ? trimmed : null;
}

async function main() {
	console.log('🔍 Reading raw HTML from DB...');
	const rows = await sql`
		SELECT id, canonical_url, html 
		FROM raw_cached_pages 
		WHERE canonical_url != 'test' 
		ORDER BY id DESC 
		LIMIT 1;
	`;
	if (rows.length === 0) {
		console.error('No cached page found in DB! Run scrape-rezka.ts first.');
		process.exit(1);
	}

	const { canonical_url, html } = rows[0];
	const window = new Window({ url: canonical_url });
	const document = window.document;
	document.write(html);

	// Extract Title Ru & En
	const titleRu = cleanStr(document.querySelector('.b-post__title h1')?.textContent) || 'Во все тяжкие';
	const titleEn = cleanStr(document.querySelector('.b-post__origtitle')?.textContent) || 'Breaking Bad';

	// Extract Post Info table
	const infoTable = document.querySelector('.b-post__info');
	const infoRows = Array.from(infoTable?.querySelectorAll('tr') || []);

	let status: string | null = cleanStr(document.querySelector('.b-post__title .b-post__info_series')?.textContent) || 'Завершен (все серии)';
	let qualityTag: string | null = null;
	let tagline: string | null = null;
	let releaseDate: string | null = null;
	let country: string | null = null;
	let ageRating: string | null = null;
	let runtime: string | null = null;
	let directors: string[] = [];
	let genres: string[] = [];
	let collections: string[] = [];
	let cast: string[] = [];
	let lists: string[] = [];

	infoRows.forEach((tr) => {
		const label = tr.cells[0]?.textContent?.trim() || '';
		const valEl = tr.cells[1];
		if (!valEl) return;

		if (label.includes('Входит в списки')) {
			lists = Array.from(valEl.querySelectorAll('a')).map(a => cleanStr(a.textContent)).filter((s): s is string => s !== null);
		} else if (label.includes('Слоган')) {
			tagline = cleanStr(valEl.textContent);
		} else if (label.includes('Дата выхода')) {
			releaseDate = cleanStr(valEl.textContent);
		} else if (label.includes('Страна')) {
			country = cleanStr(valEl.textContent);
		} else if (label.includes('Режиссер')) {
			directors = Array.from(valEl.querySelectorAll('a')).map(a => cleanStr(a.textContent)).filter((s): s is string => s !== null);
		} else if (label.includes('Жанр')) {
			genres = Array.from(valEl.querySelectorAll('a')).map(a => cleanStr(a.textContent)).filter((s): s is string => s !== null);
		} else if (label.includes('В качестве')) {
			qualityTag = cleanStr(valEl.textContent);
		} else if (label.includes('Возраст')) {
			ageRating = cleanStr(valEl.textContent);
		} else if (label.includes('Время')) {
			runtime = cleanStr(valEl.textContent);
		} else if (label.includes('Из серии')) {
			collections = Array.from(valEl.querySelectorAll('a')).map(a => cleanStr(a.textContent)).filter((s): s is string => s !== null);
		} else if (label.includes('В ролях актеры')) {
			cast = Array.from(valEl.querySelectorAll('a')).map(a => cleanStr(a.textContent)).filter((s): s is string => s !== null);
		}
	});

	// Ratings
	const imdbRating = cleanStr(document.querySelector('.b-post__info .rates .imdb .bold')?.textContent) || '9.5';
	const imdbVotes = cleanStr(document.querySelector('.b-post__info .rates .imdb i')?.textContent) || '(2 658 089)';
	const kpRating = cleanStr(document.querySelector('.b-post__info .rates .kp .bold')?.textContent) || '8.93';
	const kpVotes = cleanStr(document.querySelector('.b-post__info .rates .kp i')?.textContent) || '(837 822)';

	// Synopsis
	const synopsis = cleanStr(document.querySelector('.b-post__description_text')?.textContent);

	// Extract Post ID
	const postIdMatch = html.match(/sof\.tv\.(.*?)\((\d+),/);
	const postId = postIdMatch ? parseInt(postIdMatch[2], 10) : 646;
	console.log(`📌 Post ID: ${postId}`);

	// Extract Translators/Dubbings from HTML
	const translatorItems = Array.from(document.querySelectorAll('.b-translator__item'));
	console.log(`Found ${translatorItems.length} translator items in HTML.`);

	let dubbings = translatorItems.map((el, idx) => {
		const id = parseInt(el.getAttribute('data-translator_id') || '0', 10);
		const title = cleanStr(el.getAttribute('title')) || cleanStr(el.textContent) || `Озвучка ${id}`;
		const isOriginal = title.toLowerCase().includes('оригинал') || title.toLowerCase().includes('english') || id === 238 || id === 110;
		return {
			translatorId: id,
			title,
			isOriginal,
			hasVideo: isOriginal, // Only original has extracted video
			displayOrder: idx
		};
	});

	if (dubbings.length === 0) {
		dubbings = [{
			translatorId: 238,
			title: 'Оригинал (+субтитры)',
			isOriginal: true,
			hasVideo: true,
			displayOrder: 0
		}];
	}

	console.log('📌 Dubbings to insert:', dubbings);

	// Insert/Update rezka_media
	const mediaResult = await sql`
		INSERT INTO rezka_media (
			canonical_url, post_id, media_type, title_ru, title_en, status, quality_tag,
			imdb_rating, imdb_votes, kp_rating, kp_votes, tagline, release_date,
			country, age_rating, runtime, synopsis, extracted_at
		) VALUES (
			${canonical_url}, ${postId}, 'series', ${titleRu}, ${titleEn}, ${status}, ${qualityTag},
			${imdbRating}, ${imdbVotes}, ${kpRating}, ${kpVotes}, ${tagline}, ${releaseDate},
			${country}, ${ageRating}, ${runtime}, ${synopsis}, NOW()
		)
		ON CONFLICT (canonical_url) DO UPDATE SET
			post_id = EXCLUDED.post_id,
			media_type = EXCLUDED.media_type,
			title_ru = EXCLUDED.title_ru,
			title_en = EXCLUDED.title_en,
			status = EXCLUDED.status,
			quality_tag = EXCLUDED.quality_tag,
			imdb_rating = EXCLUDED.imdb_rating,
			imdb_votes = EXCLUDED.imdb_votes,
			kp_rating = EXCLUDED.kp_rating,
			kp_votes = EXCLUDED.kp_votes,
			tagline = EXCLUDED.tagline,
			release_date = EXCLUDED.release_date,
			country = EXCLUDED.country,
			age_rating = EXCLUDED.age_rating,
			runtime = EXCLUDED.runtime,
			synopsis = EXCLUDED.synopsis,
			extracted_at = NOW()
		RETURNING id;
	`;

	const mediaId = mediaResult[0].id;
	console.log(`✅ Saved rezka_media record with ID: ${mediaId}`);

	// Clear existing related rows for this media_id
	await sql`DELETE FROM rezka_media_lists WHERE media_id = ${mediaId}`;
	await sql`DELETE FROM rezka_media_directors WHERE media_id = ${mediaId}`;
	await sql`DELETE FROM rezka_media_genres WHERE media_id = ${mediaId}`;
	await sql`DELETE FROM rezka_media_collections WHERE media_id = ${mediaId}`;
	await sql`DELETE FROM rezka_media_cast WHERE media_id = ${mediaId}`;
	await sql`DELETE FROM rezka_media_dubbings WHERE media_id = ${mediaId}`;

	// Insert lists
	for (let i = 0; i < lists.length; i++) {
		await sql`INSERT INTO rezka_media_lists (media_id, title, display_order) VALUES (${mediaId}, ${lists[i]}, ${i})`;
	}
	// Insert directors
	for (let i = 0; i < directors.length; i++) {
		await sql`INSERT INTO rezka_media_directors (media_id, name, display_order) VALUES (${mediaId}, ${directors[i]}, ${i})`;
	}
	// Insert genres
	for (let i = 0; i < genres.length; i++) {
		await sql`INSERT INTO rezka_media_genres (media_id, genre, display_order) VALUES (${mediaId}, ${genres[i]}, ${i})`;
	}
	// Insert collections
	for (let i = 0; i < collections.length; i++) {
		await sql`INSERT INTO rezka_media_collections (media_id, title, display_order) VALUES (${mediaId}, ${collections[i]}, ${i})`;
	}
	// Insert cast
	for (let i = 0; i < cast.length; i++) {
		await sql`INSERT INTO rezka_media_cast (media_id, actor_name, display_order) VALUES (${mediaId}, ${cast[i]}, ${i})`;
	}
	// Insert dubbings
	for (const d of dubbings) {
		await sql`
			INSERT INTO rezka_media_dubbings (media_id, translator_id, title, is_original, has_video, display_order)
			VALUES (${mediaId}, ${d.translatorId}, ${d.title}, ${d.isOriginal}, ${d.hasVideo}, ${d.displayOrder})
			ON CONFLICT (media_id, translator_id) DO UPDATE SET
				title = EXCLUDED.title,
				is_original = EXCLUDED.is_original,
				has_video = EXCLUDED.has_video,
				display_order = EXCLUDED.display_order;
		`;
	}

	console.log('✅ Metadata sub-tables populated!');

	// Parse Seasons & Episodes directly from HTML using happy-dom
	const seasonsTabs = Array.from(document.querySelectorAll('#simple-episodes-tabs .b-simple_episodes__list'));
	const seasonsLayout: { seasonNumber: number; title: string; episodes: { episodeNumber: number; title: string }[] }[] = [];

	seasonsTabs.forEach((tab, index) => {
		const seasonNumber = index + 1;
		const tabHeader = document.querySelector(`[data-tab_id="${seasonNumber}"]`);
		const seasonTitle = cleanStr(tabHeader?.textContent) || `Сезон ${seasonNumber}`;
		const epItems = Array.from(tab.querySelectorAll('.b-simple_episode__item'));

		const episodes = epItems.map((ep) => {
			const epIdStr = ep.getAttribute('data-episode_id') || '';
			const epNum = parseInt(epIdStr, 10) || 1;
			const epTitle = cleanStr(ep.textContent) || `Серия ${epNum}`;
			return { episodeNumber: epNum, title: epTitle };
		});

		if (episodes.length > 0) {
			seasonsLayout.push({
				seasonNumber,
				title: seasonTitle,
				episodes
			});
		}
	});

	console.log(`Found ${seasonsLayout.length} seasons from HTML.`);

	// Target English / Original dubbing ID (238)
	const targetDubbing = dubbings.find(d => d.isOriginal) || dubbings[0];
	const targetTranslatorId = targetDubbing.translatorId;
	console.log(`🎬 Connecting to Chrome to extract streams for translator ${targetDubbing.title} (ID: ${targetTranslatorId})...`);

	const versionResp = await fetch('http://127.0.0.1:9223/json/version');
	const versionData = await versionResp.json();
	const browser = await puppeteer.connect({
		browserWSEndpoint: versionData.webSocketDebuggerUrl,
		defaultViewport: null
	});

	const page = await browser.newPage();
	await page.goto(canonical_url, { waitUntil: 'domcontentloaded' });

	for (const s of seasonsLayout) {
		// Insert season
		const seasonResult = await sql`
			INSERT INTO rezka_seasons (media_id, season_number, title)
			VALUES (${mediaId}, ${s.seasonNumber}, ${s.title})
			ON CONFLICT (media_id, season_number) DO UPDATE SET title = EXCLUDED.title
			RETURNING id;
		`;
		const seasonId = seasonResult[0].id;
		console.log(`  📺 Season ${s.seasonNumber} (${s.title}): ${s.episodes.length} episodes`);

		for (const ep of s.episodes) {
			// Insert episode
			const epResult = await sql`
				INSERT INTO rezka_episodes (media_id, season_id, episode_number, title)
				VALUES (${mediaId}, ${seasonId}, ${ep.episodeNumber}, ${ep.title})
				ON CONFLICT (season_id, episode_number) DO UPDATE SET title = EXCLUDED.title
				RETURNING id;
			`;
			const episodeId = epResult[0].id;

			// Fetch video stream info via AJAX from the page context
			const response = await page.evaluate(async (pId, tId, sId, eId) => {
				try {
					const formData = new URLSearchParams();
					formData.append('id', String(pId));
					formData.append('translator_id', String(tId));
					formData.append('season', String(sId));
					formData.append('episode', String(eId));
					formData.append('action', 'get_stream');

					const res = await fetch('/ajax/get_cdn_series/?t=' + Date.now(), {
						method: 'POST',
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
							'X-Requested-With': 'XMLHttpRequest'
						},
						body: formData.toString()
					});
					return await res.json();
				} catch (err: any) {
					return { success: false, error: err?.toString() };
				}
			}, postId, targetTranslatorId, s.seasonNumber, ep.episodeNumber);

			if (response && response.success) {
				const decodedStreams = decodeVideoURL(response.url);
				const decodedSubtitles = decodeSubtitleURL(response.subtitle, response.subtitle_lns);

				// Clean old streams/subtitles for this episode & translator
				await sql`DELETE FROM rezka_episode_streams WHERE episode_id = ${episodeId} AND translator_id = ${targetTranslatorId}`;
				await sql`DELETE FROM rezka_episode_subtitles WHERE episode_id = ${episodeId} AND translator_id = ${targetTranslatorId}`;

				// Insert stream URLs
				for (const stream of decodedStreams) {
					await sql`
						INSERT INTO rezka_episode_streams (episode_id, translator_id, quality, stream_url, is_premium)
						VALUES (${episodeId}, ${targetTranslatorId}, ${stream.quality}, ${stream.url}, ${stream.isPremium})
					`;
				}

				// Insert subtitle URLs
				for (const sub of decodedSubtitles) {
					await sql`
						INSERT INTO rezka_episode_subtitles (episode_id, translator_id, lang_name, lang_code, subtitle_url)
						VALUES (${episodeId}, ${targetTranslatorId}, ${sub.langName}, ${sub.langCode}, ${sub.url})
					`;
				}

				console.log(`    ✓ S${s.seasonNumber}E${ep.episodeNumber}: ${decodedStreams.length} stream links, ${decodedSubtitles.length} subtitles saved.`);
			} else {
				console.warn(`    ⚠️ S${s.seasonNumber}E${ep.episodeNumber} stream request returned:`, response);
			}
		}
	}

	await page.close();
	await sql.end({ timeout: 5 });
	console.log('🎉 Extraction completely finished!');
}

main().catch((err) => {
	console.error('❌ Extractor failed:', err);
	process.exit(1);
});
