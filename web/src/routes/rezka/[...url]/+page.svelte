<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, tick } from 'svelte';
	import Hls from 'hls.js';
	import type { StreamItem, SubtitleItem } from '$lib/types/rezka';

	let { data }: { data: PageData } = $props();
	let media = $derived(data.rezkaData);

	// Dubbing state
	let defaultDubbingId = $derived(
		media.dubbings.find((d) => d.hasVideo)?.translatorId ?? (media.dubbings[0]?.translatorId || 238)
	);
	let selectedDubbingId = $state<number | null>(null);
	let activeDubbingId = $derived(selectedDubbingId ?? defaultDubbingId);

	// Season & Episode state
	let selectedSeasonIndex = $state<number>(0);
	let selectedEpisodeIndex = $state<number>(0);

	let currentSeason = $derived(media.seasons[selectedSeasonIndex] || media.seasons[0]);
	let currentEpisode = $derived(currentSeason?.episodes[selectedEpisodeIndex] || currentSeason?.episodes[0]);

	// Streams and Subtitles fetched for the active episode
	let activeStreams = $state<StreamItem[]>([]);
	let activeSubtitles = $state<SubtitleItem[]>([]);
	let isLoadingStream = $state<boolean>(false);
	let selectedQuality = $state<string>('');

	// Active Video URL derived from selected quality
	let rawVideoUrl = $derived.by(() => {
		if (activeStreams.length === 0) return null;
		if (selectedQuality) {
			const found = activeStreams.find((s) => s.quality === selectedQuality);
			if (found) return found.streamUrl;
		}
		// Prefer 720p or 1080p, else first
		const default720 = activeStreams.find((s) => s.quality === '720p');
		const default1080 = activeStreams.find((s) => s.quality === '1080p');
		return default720?.streamUrl || default1080?.streamUrl || activeStreams[0]?.streamUrl;
	});

	// Use proxy to ensure 100% reliable CORS, SSL, and partial range request playback
	let activeVideoUrl = $derived.by(() => {
		if (!rawVideoUrl) return null;
		return `/api/proxy/video?url=${encodeURIComponent(rawVideoUrl)}`;
	});

	let availableQualities = $derived.by(() => {
		const qSet = new Set<string>();
		activeStreams.forEach((s) => qSet.add(s.quality));
		return Array.from(qSet);
	});

	let videoElement = $state<HTMLVideoElement | null>(null);
	let hlsInstance: Hls | null = null;
	let playbackError = $state<string | null>(null);

	async function fetchEpisodeStreams(seasonNum: number, epNum: number, transId: number) {
		isLoadingStream = true;
		playbackError = null;
		try {
			const resp = await fetch(`/api/rezka/stream?id=${media.postId}&translator_id=${transId}&season=${seasonNum}&episode=${epNum}`);
			const result = await resp.json();
			if (result.success && result.streams && result.streams.length > 0) {
				activeStreams = result.streams;
				activeSubtitles = result.subtitles || [];
			} else {
				playbackError = result.error || 'Failed to load video stream for this episode.';
			}
		} catch (err: any) {
			playbackError = err?.message || 'Network error fetching stream.';
		} finally {
			isLoadingStream = false;
		}
	}

	function loadVideoSource(url: string | null) {
		playbackError = null;
		if (!videoElement || !url) return;

		if (Hls.isSupported() && url.includes('.m3u8')) {
			if (hlsInstance) {
				hlsInstance.destroy();
				hlsInstance = null;
			}
			hlsInstance = new Hls({
				enableWorker: true,
				lowLatencyMode: false
			});
			hlsInstance.loadSource(url);
			hlsInstance.attachMedia(videoElement);

			hlsInstance.on(Hls.Events.ERROR, (_event, errorData) => {
				if (errorData.fatal) {
					console.warn('HLS fallback to direct proxy source:', errorData);
					hlsInstance?.destroy();
					hlsInstance = null;
					if (videoElement) {
						videoElement.src = url;
					}
				}
			});
		} else {
			if (hlsInstance) {
				hlsInstance.destroy();
				hlsInstance = null;
			}
			videoElement.src = url;
		}
	}

	// Fetch streams when season/episode/dubbing changes
	$effect(() => {
		const sNum = currentSeason?.seasonNumber || 1;
		const epNum = currentEpisode?.episodeNumber || 1;
		const tId = activeDubbingId;
		fetchEpisodeStreams(sNum, epNum, tId);
	});

	// Load video into player when activeVideoUrl changes
	$effect(() => {
		const url = activeVideoUrl;
		tick().then(() => {
			loadVideoSource(url);
		});
	});

	onMount(() => {
		return () => {
			if (hlsInstance) {
				hlsInstance.destroy();
				hlsInstance = null;
			}
		};
	});

	function handleSeasonChange(index: number) {
		selectedSeasonIndex = index;
		selectedEpisodeIndex = 0;
	}

	function handleEpisodeChange(index: number) {
		selectedEpisodeIndex = index;
	}

	function handleDubbingClick(dubbing: typeof media.dubbings[0]) {
		if (!dubbing.hasVideo) {
			alert(`No scraped stream data for ${dubbing.title}. Only Original (English + subtitles) stream links are extracted.`);
			return;
		}
		selectedDubbingId = dubbing.translatorId;
	}
</script>

<svelte:head>
	<title>{media.titleRu} ({media.titleEn}) - HDRezka Online</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased selection:bg-amber-500/30 selection:text-amber-200">
	<!-- Top Navigation -->
	<header class="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/80 border-b border-zinc-800 px-4 lg:px-8 py-3.5">
		<div class="max-w-7xl mx-auto flex items-center justify-between">
			<a href="/" class="flex items-center gap-2.5 text-zinc-300 hover:text-white transition-colors group">
				<div class="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 group-hover:border-zinc-700">
					<svg class="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
					</svg>
				</div>
				<span class="text-sm font-semibold tracking-wide">Back to IMDb Catalog</span>
			</a>

			<div class="flex items-center gap-2">
				<span class="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium flex items-center gap-1.5">
					<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
					Scraped from rezka.ag
				</span>
			</div>
		</div>
	</header>

	<main class="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-10">
		<!-- Series Header / Title Bar -->
		<section class="space-y-3">
			<div class="flex flex-wrap items-center gap-3">
				<h1 class="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
					{media.titleRu}
				</h1>
				{#if media.titleEn}
					<span class="text-2xl md:text-3xl font-semibold text-zinc-400 font-serif">
						/ {media.titleEn}
					</span>
				{/if}
			</div>

			<div class="flex flex-wrap items-center gap-2.5 text-xs text-zinc-300">
				{#if media.status}
					<span class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
						{media.status}
					</span>
				{/if}
				{#if media.qualityTag}
					<span class="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
						Смотреть {media.titleRu} онлайн в HD качестве {media.qualityTag}
					</span>
				{/if}
				<button class="px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors font-medium flex items-center gap-1.5">
					<svg class="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
						<path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
					</svg>
					Смотреть трейлер
				</button>
			</div>
		</section>

		<!-- Video Player Section with Dubbing, Season, Episode selectors -->
		<section class="rounded-3xl bg-zinc-900 border border-zinc-800/80 p-4 md:p-6 space-y-6 shadow-2xl overflow-hidden">
			<!-- Dubbing / Translator selection -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<span class="text-xs font-bold uppercase tracking-wider text-zinc-400">
						В русской озвучке от:
					</span>
					<span class="text-xs text-zinc-500">Не можешь выбрать озвучку?</span>
				</div>

				<div class="flex flex-wrap gap-2">
					{#each media.dubbings as dubbing}
						{@const isActive = dubbing.translatorId === activeDubbingId}
						{@const isEnabled = dubbing.hasVideo}
						<button
							onclick={() => handleDubbingClick(dubbing)}
							class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 border flex items-center gap-1.5
							{isActive
								? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-lg shadow-amber-500/20 font-bold'
								: isEnabled
									? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
									: 'bg-zinc-900/60 text-zinc-500 border-zinc-800/80 cursor-not-allowed opacity-60'}"
						>
							{#if dubbing.isOriginal}
								<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
							{/if}
							<span>{dubbing.title}</span>
							{#if !isEnabled}
								<span class="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">No stream</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<!-- Video Player Container -->
			<div class="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800 shadow-inner group">
				{#if isLoadingStream}
					<div class="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-10">
						<div class="flex items-center gap-3 px-4 py-2 rounded-xl bg-zinc-900/90 border border-zinc-700 text-xs text-zinc-200">
							<span class="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
							<span>Loading stream for {currentSeason?.title} {currentEpisode?.title}...</span>
						</div>
					</div>
				{/if}

				<video
					bind:this={videoElement}
					controls
					playsinline
					preload="metadata"
					class="w-full h-full object-contain"
				>
					{#each activeSubtitles as sub}
						<track
							kind="subtitles"
							label={sub.langName}
							srclang={sub.langCode}
							src={sub.subtitleUrl}
							default={sub.langCode.includes('en') || sub.langCode.includes('ru')}
						/>
					{/each}
				</video>

				{#if playbackError}
					<div class="absolute inset-0 bg-black/80 flex items-center justify-center p-6 text-center z-20">
						<div class="max-w-md space-y-3">
							<p class="text-amber-400 text-sm font-semibold">{playbackError}</p>
							{#if activeVideoUrl}
								<p class="text-xs text-zinc-400 break-all">Stream URL: {activeVideoUrl}</p>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Player Info Bar: Stream Quality & Subtitle Pickers -->
			<div class="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 text-xs">
				<div class="flex items-center gap-3">
					<span class="text-zinc-400 font-medium">Качество:</span>
					<div class="flex flex-wrap gap-1.5">
						{#each availableQualities as q}
							<button
								onclick={() => (selectedQuality = q)}
								class="px-2.5 py-1 rounded-lg font-mono text-xs font-semibold transition-colors border
								{selectedQuality === q || (!selectedQuality && (q === '720p' || q === '1080p'))
									? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold'
									: 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'}"
							>
								{q}
							</button>
						{/each}
					</div>
				</div>

				{#if activeSubtitles.length > 0}
					<div class="flex items-center gap-2">
						<span class="text-zinc-400 font-medium">Субтитры:</span>
						<span class="text-xs text-zinc-300 font-medium">
							{activeSubtitles.map((s) => s.langName).join(', ')}
						</span>
					</div>
				{/if}
			</div>

			<!-- Seasons Selector -->
			<div class="space-y-2">
				<span class="text-xs font-bold uppercase tracking-wider text-zinc-400">Сезоны:</span>
				<div class="flex flex-wrap gap-2">
					{#each media.seasons as season, sIndex}
						<button
							onclick={() => handleSeasonChange(sIndex)}
							class="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 border
							{selectedSeasonIndex === sIndex
								? 'bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 border-amber-400 shadow-md shadow-amber-500/20'
								: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'}"
						>
							{season.title}
						</button>
					{/each}
				</div>
			</div>

			<!-- Episodes Selector -->
			<div class="space-y-2">
				<span class="text-xs font-bold uppercase tracking-wider text-zinc-400">Серии ({currentSeason?.title}):</span>
				<div class="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
					{#each currentSeason?.episodes || [] as episode, eIndex}
						<button
							onclick={() => handleEpisodeChange(eIndex)}
							class="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border
							{selectedEpisodeIndex === eIndex
								? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-md shadow-amber-500/20 font-bold'
								: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'}"
						>
							{episode.title}
						</button>
					{/each}
				</div>
			</div>

			<div class="pt-2 text-xs text-zinc-500 border-t border-zinc-800">
				Плеер также доступен на телефоне и планшете под управлением андроид (Android с поддержкой HLS), и на iPhone и iPad под управлением iOS.
				Во все тяжкие - смотрите все серии бесплатно!
			</div>
		</section>

		<!-- Detailed Series Info Section -->
		<section class="grid grid-cols-1 lg:grid-cols-3 gap-8">
			<!-- Left column: Metadata table -->
			<div class="lg:col-span-2 space-y-6">
				<div class="rounded-3xl bg-zinc-900 border border-zinc-800/80 p-6 space-y-6 shadow-xl">
					<h3 class="text-lg font-bold text-white border-b border-zinc-800 pb-3 flex items-center gap-2">
						<svg class="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span>О сериале «{media.titleRu}»</span>
					</h3>

					<dl class="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-6 text-sm">
						<!-- Ratings -->
						<dt class="font-medium text-zinc-400">Рейтинги:</dt>
						<dd class="sm:col-span-2 flex flex-wrap gap-4 text-zinc-200">
							{#if media.imdbRating}
								<span class="inline-flex items-center gap-1.5 font-bold text-amber-400">
									<span class="px-1.5 py-0.5 rounded bg-amber-500 text-zinc-950 text-[10px] font-black">IMDb</span>
									{media.imdbRating} <span class="font-normal text-zinc-400 text-xs">{media.imdbVotes}</span>
								</span>
							{/if}
							{#if media.kpRating}
								<span class="inline-flex items-center gap-1.5 font-bold text-orange-400">
									<span class="px-1.5 py-0.5 rounded bg-orange-500 text-zinc-950 text-[10px] font-black">Кинопоиск</span>
									{media.kpRating} <span class="font-normal text-zinc-400 text-xs">{media.kpVotes}</span>
								</span>
							{/if}
						</dd>

						<!-- Lists -->
						{#if media.lists.length > 0}
							<dt class="font-medium text-zinc-400">Входит в списки:</dt>
							<dd class="sm:col-span-2 space-y-1 text-zinc-300">
								{#each media.lists as listTitle}
									<div class="flex items-center gap-2">
										<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
										<span>{listTitle}</span>
									</div>
								{/each}
							</dd>
						{/if}

						<!-- Tagline -->
						{#if media.tagline}
							<dt class="font-medium text-zinc-400">Слоган:</dt>
							<dd class="sm:col-span-2 text-zinc-200 italic">{media.tagline}</dd>
						{/if}

						<!-- Release date -->
						{#if media.releaseDate}
							<dt class="font-medium text-zinc-400">Дата выхода:</dt>
							<dd class="sm:col-span-2 text-zinc-200">{media.releaseDate}</dd>
						{/if}

						<!-- Country -->
						{#if media.country}
							<dt class="font-medium text-zinc-400">Страна:</dt>
							<dd class="sm:col-span-2 text-zinc-200">{media.country}</dd>
						{/if}

						<!-- Directors -->
						{#if media.directors.length > 0}
							<dt class="font-medium text-zinc-400">Режиссер:</dt>
							<dd class="sm:col-span-2 text-zinc-200">{media.directors.join(', ')}</dd>
						{/if}

						<!-- Genres -->
						{#if media.genres.length > 0}
							<dt class="font-medium text-zinc-400">Жанр:</dt>
							<dd class="sm:col-span-2 flex flex-wrap gap-1.5">
								{#each media.genres as g}
									<span class="px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs">
										{g}
									</span>
								{/each}
							</dd>
						{/if}

						<!-- Quality -->
						{#if media.qualityTag}
							<dt class="font-medium text-zinc-400">В качестве:</dt>
							<dd class="sm:col-span-2 text-zinc-200 font-mono font-bold text-amber-400">{media.qualityTag}</dd>
						{/if}

						<!-- Age rating -->
						{#if media.ageRating}
							<dt class="font-medium text-zinc-400">Возраст:</dt>
							<dd class="sm:col-span-2 text-zinc-200">{media.ageRating}</dd>
						{/if}

						<!-- Runtime -->
						{#if media.runtime}
							<dt class="font-medium text-zinc-400">Время:</dt>
							<dd class="sm:col-span-2 text-zinc-200">{media.runtime}</dd>
						{/if}

						<!-- Collections -->
						{#if media.collections.length > 0}
							<dt class="font-medium text-zinc-400">Из серии:</dt>
							<dd class="sm:col-span-2 flex flex-wrap gap-1.5">
								{#each media.collections as c}
									<span class="px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-300 text-xs">
										{c}
									</span>
								{/each}
							</dd>
						{/if}

						<!-- Cast -->
						{#if media.cast.length > 0}
							<dt class="font-medium text-zinc-400">В ролях актеры:</dt>
							<dd class="sm:col-span-2 text-zinc-300 leading-relaxed">
								{media.cast.join(', ')}
							</dd>
						{/if}
					</dl>
				</div>

				<!-- Synopsis Block -->
				{#if media.synopsis}
					<div class="rounded-3xl bg-zinc-900 border border-zinc-800/80 p-6 space-y-3 shadow-xl">
						<h3 class="text-base font-bold text-white flex items-center gap-2">
							<svg class="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
							</svg>
							<span>Про что сериал «{media.titleRu}»:</span>
						</h3>
						<p class="text-zinc-300 text-sm leading-relaxed whitespace-pre-line">
							{media.synopsis}
						</p>
					</div>
				{/if}
			</div>

			<!-- Right column: Extra details & Highlights -->
			<div class="space-y-6">
				<div class="rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/80 p-6 space-y-5 shadow-xl">
					<h3 class="text-base font-bold text-white flex items-center gap-2">
						<span class="w-2 h-2 rounded-full bg-amber-500"></span>
						<span>Original Master Audio & Video</span>
					</h3>
					<div class="space-y-3 text-xs text-zinc-300">
						<div class="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-1">
							<span class="font-bold text-amber-400 block">Original English Audio</span>
							<p class="text-zinc-400">All 5 seasons (62 episodes) extracted in crystal clear high bitrate stream format.</p>
						</div>
						<div class="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-1">
							<span class="font-bold text-emerald-400 block">Multiple Subtitle Tracks</span>
							<p class="text-zinc-400">Timed VTT subtitles in English, Russian, and Ukrainian.</p>
						</div>
						<div class="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 space-y-1">
							<span class="font-bold text-indigo-400 block">Adaptive Bitrate Streaming</span>
							<p class="text-zinc-400">Available in 360p, 480p, 720p, 1080p and 1080p Ultra.</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	</main>
</div>
