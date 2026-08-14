<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchQuery = $derived(data.search);
	let selectedType = $derived(data.type);

	function formatVotes(votes: number | null): string {
		if (!votes) return '0';
		if (votes >= 1_000_000) return (votes / 1_000_000).toFixed(1) + 'M';
		if (votes >= 1_000) return (votes / 1_000).toFixed(1) + 'K';
		return String(votes);
	}

	function getTypeBadge(type: string): { label: string; color: string } {
		switch (type) {
			case 'movie':
				return { label: 'Movie', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
			case 'tvSeries':
				return { label: 'TV Series', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
			case 'tvMiniSeries':
				return { label: 'Mini-Series', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
			default:
				return { label: type, color: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30' };
		}
	}
</script>

<svelte:head>
	<title>WikiDub - Movies & TV Series IMDb Archive</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased selection:bg-amber-500/30 selection:text-amber-200">
	<!-- Navbar / Header -->
	<header class="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/80 border-b border-zinc-800/80 px-4 lg:px-8 py-4">
		<div class="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
			<div class="flex items-center space-x-3">
				<div class="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
					<svg class="w-6 h-6 text-zinc-950 font-bold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<div>
					<h1 class="text-xl font-bold tracking-tight bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
						WikiDub
					</h1>
					<p class="text-xs text-zinc-400 font-medium">IMDb Archive & HDRezka Scraper</p>
				</div>
			</div>

			<!-- Quick Scraped Link Notification Banner -->
			<div class="flex items-center space-x-3">
				<a
					href="/rezka/series/thriller/646-vo-vse-tyazhkie-2008-latest.html"
					class="group inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-semibold shadow-lg shadow-emerald-950/50 hover:shadow-emerald-600/20 transition-all duration-200 border border-emerald-500/30"
				>
					<span class="relative flex h-2 w-2">
						<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
						<span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
					</span>
					<span>Watch Scraped: <strong>Breaking Bad (Vo Vse Tyazhkie)</strong></span>
					<svg class="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				</a>
			</div>
		</div>
	</header>

	<main class="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
		<!-- Hero Section -->
		<section class="relative overflow-hidden rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-900/60 to-zinc-950 border border-zinc-800/80 p-6 md:p-10 shadow-2xl">
			<div class="absolute -right-20 -top-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
			<div class="absolute -left-20 -bottom-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

			<div class="relative z-10 space-y-6 max-w-3xl">
				<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
					<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
						<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
					</svg>
					<span>{data.totalCount.toLocaleString()} Top Ranked Titles Loaded</span>
				</div>

				<h2 class="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
					Explore The Complete <span class="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-200 bg-clip-text text-transparent">IMDb Collection</span>
				</h2>

				<p class="text-zinc-400 text-sm md:text-base leading-relaxed">
					Browse the database of movies and television series with IMDb ratings and vote counts.
					Direct HDRezka player integration available for scraped series.
				</p>

				<!-- Search & Filter Bar -->
				<form method="GET" class="flex flex-col sm:flex-row gap-3 pt-2">
					<div class="relative flex-1">
						<svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
						<input
							type="text"
							name="q"
							bind:value={searchQuery}
							placeholder="Search by title (e.g. Breaking Bad, Matrix, Inception)..."
							class="w-full pl-10 pr-4 py-3 bg-zinc-900/90 border border-zinc-700/80 rounded-xl text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
						/>
					</div>

					<div class="flex gap-2">
						<select
							name="type"
							bind:value={selectedType}
							class="px-4 py-3 bg-zinc-900/90 border border-zinc-700/80 rounded-xl text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
						>
							<option value="all">All Types</option>
							<option value="movie">Movies</option>
							<option value="tvSeries">TV Series</option>
							<option value="tvMiniSeries">Mini-Series</option>
						</select>

						<button
							type="submit"
							class="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-sm rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all duration-200"
						>
							Search
						</button>
					</div>
				</form>
			</div>
		</section>

		<!-- Titles Grid -->
		<section class="space-y-6">
			<div class="flex items-center justify-between">
				<h3 class="text-xl font-bold text-zinc-100 flex items-center gap-2">
					<span>Most Popular Titles</span>
					<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">Page {data.page}</span>
				</h3>
				<span class="text-xs text-zinc-400">Sorted by IMDb popularity</span>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
				{#each data.titles as title (title.tconst)}
					{@const badge = getTypeBadge(title.titleType)}
					<div
						class="group relative bg-zinc-900/70 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-xl hover:shadow-zinc-950/80 hover:-translate-y-0.5"
					>
						<div class="space-y-3">
							<!-- Header badges -->
							<div class="flex items-center justify-between gap-2">
								<span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg border {badge.color}">
									{badge.label}
								</span>
								{#if title.startYear}
									<span class="text-xs font-mono text-zinc-400">
										{title.startYear}{title.endYear ? `–${title.endYear}` : ''}
									</span>
								{/if}
							</div>

							<!-- Title -->
							<div>
								<h4 class="font-bold text-base text-zinc-100 group-hover:text-amber-400 transition-colors line-clamp-1">
									{title.primaryTitle}
								</h4>
								{#if title.originalTitle && title.originalTitle !== title.primaryTitle}
									<p class="text-xs text-zinc-400 line-clamp-1 mt-0.5 italic">
										{title.originalTitle}
									</p>
								{/if}
							</div>

							<!-- Genres -->
							{#if title.genres && title.genres.length > 0}
								<div class="flex flex-wrap gap-1.5 pt-1">
									{#each title.genres.slice(0, 3) as g}
										<span class="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800/90 text-zinc-300 border border-zinc-700/50">
											{g}
										</span>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Footer info -->
						<div class="pt-4 mt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs">
							<div class="flex items-center gap-1 text-amber-400 font-bold">
								<svg class="w-4 h-4 fill-current" viewBox="0 0 20 20">
									<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
								</svg>
								<span>{title.averageRating ?? 'N/A'}</span>
								<span class="text-[11px] text-zinc-500 font-normal">({formatVotes(title.numVotes)})</span>
							</div>

							{#if title.runtimeMinutes}
								<span class="text-zinc-500 text-[11px]">{title.runtimeMinutes} min</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<!-- Pagination -->
			<div class="flex items-center justify-center gap-3 pt-6">
				{#if data.page > 1}
					<a
						href="?page={data.page - 1}{data.search ? `&q=${encodeURIComponent(data.search)}` : ''}{data.type !== 'all' ? `&type=${data.type}` : ''}"
						class="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm font-semibold hover:bg-zinc-800 transition-colors"
					>
						Previous Page
					</a>
				{/if}
				<span class="px-4 py-2 text-sm text-zinc-400 font-mono">
					Page {data.page} of {Math.ceil(data.totalCount / data.limit)}
				</span>
				{#if data.page * data.limit < data.totalCount}
					<a
						href="?page={data.page + 1}{data.search ? `&q=${encodeURIComponent(data.search)}` : ''}{data.type !== 'all' ? `&type=${data.type}` : ''}"
						class="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm font-semibold hover:bg-zinc-800 transition-colors"
					>
						Next Page
					</a>
				{/if}
			</div>
		</section>
	</main>
</div>
