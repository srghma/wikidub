export interface DubbingItem {
	translatorId: number;
	title: string;
	isOriginal: boolean;
	hasVideo: boolean;
	displayOrder: number;
}

export interface StreamItem {
	quality: string;
	streamUrl: string;
	isPremium: boolean;
}

export interface SubtitleItem {
	langName: string;
	langCode: string;
	subtitleUrl: string;
}

export interface EpisodeItem {
	episodeNumber: number;
	title: string;
	streams?: StreamItem[];
	subtitles?: SubtitleItem[];
}

export interface SeasonItem {
	seasonNumber: number;
	title: string;
	episodes: EpisodeItem[];
}

export interface InputTypeForRezkaRouter {
	canonicalUrl: string;
	postId: number;
	mediaType: 'series' | 'movie';
	titleRu: string;
	titleEn: string | null;
	status: string | null;
	qualityTag: string | null;
	imdbRating: string | null;
	imdbVotes: string | null;
	kpRating: string | null;
	kpVotes: string | null;
	tagline: string | null;
	releaseDate: string | null;
	country: string | null;
	ageRating: string | null;
	runtime: string | null;
	synopsis: string | null;
	lists: string[];
	directors: string[];
	genres: string[];
	collections: string[];
	cast: string[];
	dubbings: DubbingItem[];
	seasons: SeasonItem[];
	initialStreams: StreamItem[];
	initialSubtitles: SubtitleItem[];
}
