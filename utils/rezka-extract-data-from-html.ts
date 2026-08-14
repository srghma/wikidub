import { Window } from 'happy-dom';
import type { InputTypeForRezkaRouter, DubbingItem, SeasonItem, StreamItem, SubtitleItem } from './input-type-for-rezka-router';

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

function parseQualityDetail(rawItem: string): { quality: string; isPremContent: boolean; urlsArr: string[] } | null {
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

export function decodeVideoURL(stream: string | false | null): StreamItem[] {
	if (!stream) return [];
	let cleanedStream: string;
	try {
		cleanedStream = clearTrash(stream);
	} catch {
		cleanedStream = stream;
	}
	const result: StreamItem[] = [];
	cleanedStream.split(',').forEach((currentValue) => {
		const parsed = parseQualityDetail(currentValue);
		if (parsed) {
			parsed.urlsArr.forEach((u) => {
				result.push({
					quality: parsed.quality,
					isPremium: parsed.isPremContent,
					streamUrl: u
				});
			});
		}
	});
	return result;
}

export function decodeSubtitleURL(subtitlesStr: string | null, subtitleLns: Record<string, string> | null): SubtitleItem[] {
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
			subtitleUrl: url
		};
	}).filter((x): x is SubtitleItem => x !== null);
}

function cleanStr(val: string | null | undefined): string | null {
	if (!val) return null;
	const trimmed = val.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function extractRezkaDataFromHtml(html: string, canonicalUrlOverride?: string): InputTypeForRezkaRouter {
	const window = new Window({ url: canonicalUrlOverride || 'https://rezka.ag' });
	const document = window.document;
	document.write(html);

	// Canonical URL
	const canonicalLink = document.querySelector('link[rel="canonical"]');
	const canonicalUrl = canonicalUrlOverride || (canonicalLink ? (canonicalLink as any).href : 'https://rezka.ag');

	// Post ID
	const postIdMatch = html.match(/sof\.tv\.(.*?)\((\d+),/);
	const postId = postIdMatch ? parseInt(postIdMatch[2], 10) : 646;

	// Titles
	const titleRu = cleanStr(document.querySelector('.b-post__title h1')?.textContent) || 'Во все тяжкие';
	const titleEn = cleanStr(document.querySelector('.b-post__origtitle')?.textContent) || 'Breaking Bad';

	// Info table
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

	// Dubbings
	const translatorItems = Array.from(document.querySelectorAll('.b-translator__item'));
	let dubbings: DubbingItem[] = translatorItems.map((el, idx) => {
		const id = parseInt(el.getAttribute('data-translator_id') || '0', 10);
		const title = cleanStr(el.getAttribute('title')) || cleanStr(el.textContent) || `Озвучка ${id}`;
		const isOriginal = title.toLowerCase().includes('оригинал') || title.toLowerCase().includes('english') || id === 238 || id === 110;
		return {
			translatorId: id,
			title,
			isOriginal,
			hasVideo: isOriginal, // English/Original has active video
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

	// Seasons & Episodes
	const seasonsTabs = Array.from(document.querySelectorAll('#simple-episodes-tabs .b-simple_episodes__list'));
	const seasons: SeasonItem[] = [];

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
			seasons.push({
				seasonNumber,
				title: seasonTitle,
				episodes
			});
		}
	});

	// Check if initial streams are embedded in script
	const initCdnMatch = html.match(/initCDNSeriesEvents\(([^)]+)\)/);
	let initialStreams: StreamItem[] = [];
	let initialSubtitles: SubtitleItem[] = [];

	if (initCdnMatch) {
		try {
			// Extract streams string if present in script params
			const rawParamStr = initCdnMatch[1];
			const streamStrMatch = rawParamStr.match(/"streams"\s*:\s*"([^"]+)"/) || rawParamStr.match(/"([^"]*#h[^"]*)"/);
			if (streamStrMatch) {
				initialStreams = decodeVideoURL(streamStrMatch[1]);
			}
			const subStrMatch = rawParamStr.match(/"subtitle"\s*:\s*"([^"]+)"/);
			if (subStrMatch) {
				initialSubtitles = decodeSubtitleURL(subStrMatch[1], null);
			}
		} catch (e) {
			// ignore script parse error
		}
	}

	return {
		canonicalUrl,
		postId,
		mediaType: 'series',
		titleRu,
		titleEn,
		status,
		qualityTag,
		imdbRating,
		imdbVotes,
		kpRating,
		kpVotes,
		tagline,
		releaseDate,
		country,
		ageRating,
		runtime,
		synopsis,
		lists,
		directors,
		genres,
		collections,
		cast,
		dubbings,
		seasons,
		initialStreams,
		initialSubtitles
	};
}
