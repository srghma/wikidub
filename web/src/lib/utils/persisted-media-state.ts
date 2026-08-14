export interface PersistedMediaSettings {
	seasonIndex: number;
	episodeIndex: number;
	quality: string;
	dubbingId: number | null;
	enabledSubtitleCodes: string[];
}

const DEFAULT_SETTINGS: PersistedMediaSettings = {
	seasonIndex: 0,
	episodeIndex: 0,
	quality: '360p',
	dubbingId: null,
	enabledSubtitleCodes: ['en']
};

function getStorageKey(canonicalUrl: string): string {
	return `wikidub_media:${canonicalUrl.trim()}`;
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
		return {
			seasonIndex: typeof parsed.seasonIndex === 'number' ? parsed.seasonIndex : (defaults?.seasonIndex ?? DEFAULT_SETTINGS.seasonIndex),
			episodeIndex: typeof parsed.episodeIndex === 'number' ? parsed.episodeIndex : (defaults?.episodeIndex ?? DEFAULT_SETTINGS.episodeIndex),
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
