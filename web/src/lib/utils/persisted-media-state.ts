import type { ValidNonNegativeInt } from '../../core/toNumber/validNonNegativeInt.js';
import {
	numberToValidNonNegativeIntOrUndefined,
	number_toValidNonNegativeInt_unsafe
} from '../../core/toNumber/validNonNegativeInt.js';
import {
	String_toNonEmptyString_orUndefined_afterTrim
} from '../../core/non-empty-string-trimmed.js';

export interface PersistedMediaSettings {
	seasonIndex: ValidNonNegativeInt;
	episodeIndex: ValidNonNegativeInt;
	quality: string;
	dubbingId: number | null;
	enabledSubtitleCodes: string[];
}

const DEFAULT_SETTINGS: PersistedMediaSettings = {
	seasonIndex: number_toValidNonNegativeInt_unsafe(0),
	episodeIndex: number_toValidNonNegativeInt_unsafe(0),
	quality: '360p',
	dubbingId: null,
	enabledSubtitleCodes: ['en']
};

function getStorageKey(canonicalUrl: string): string {
	const trimmed = String_toNonEmptyString_orUndefined_afterTrim(canonicalUrl) ?? 'default';
	return `wikidub_media:${trimmed}`;
}

export function loadMediaSettings(canonicalUrl: string, defaults?: Partial<PersistedMediaSettings>): PersistedMediaSettings {
	if (typeof window === 'undefined' || !window.localStorage) {
		return { ...DEFAULT_SETTINGS, ...defaults };
	}

	try {
		const raw = localStorage.getItem(getStorageKey(canonicalUrl));
		if (!raw) {
			return { ...DEFAULT_SETTINGS, ...defaults };
		}
		const parsed = JSON.parse(raw);
		const parsedSeason = typeof parsed.seasonIndex === 'number' ? numberToValidNonNegativeIntOrUndefined(parsed.seasonIndex) : undefined;
		const parsedEpisode = typeof parsed.episodeIndex === 'number' ? numberToValidNonNegativeIntOrUndefined(parsed.episodeIndex) : undefined;

		return {
			seasonIndex: parsedSeason ?? defaults?.seasonIndex ?? DEFAULT_SETTINGS.seasonIndex,
			episodeIndex: parsedEpisode ?? defaults?.episodeIndex ?? DEFAULT_SETTINGS.episodeIndex,
			quality: typeof parsed.quality === 'string' ? parsed.quality : (defaults?.quality ?? DEFAULT_SETTINGS.quality),
			dubbingId: typeof parsed.dubbingId === 'number' ? parsed.dubbingId : (defaults?.dubbingId ?? DEFAULT_SETTINGS.dubbingId),
			enabledSubtitleCodes: Array.isArray(parsed.enabledSubtitleCodes) ? parsed.enabledSubtitleCodes : (defaults?.enabledSubtitleCodes ?? DEFAULT_SETTINGS.enabledSubtitleCodes)
		};
	} catch {
		return { ...DEFAULT_SETTINGS, ...defaults };
	}
}

export function saveMediaSettings(canonicalUrl: string, settings: Partial<PersistedMediaSettings>): void {
	if (typeof window === 'undefined' || !window.localStorage) return;

	try {
		const current = loadMediaSettings(canonicalUrl);
		const updated = { ...current, ...settings };
		localStorage.setItem(getStorageKey(canonicalUrl), JSON.stringify(updated));
	} catch {
		// Ignore storage quota or disabled storage errors
	}
}
