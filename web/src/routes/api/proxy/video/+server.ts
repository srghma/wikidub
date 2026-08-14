import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, request }) => {
	const targetUrl = url.searchParams.get('url');
	if (!targetUrl) {
		return new Response('Missing url parameter', { status: 400 });
	}

	const isM3u8 = targetUrl.includes('.m3u8');
	const isTs = targetUrl.includes('.ts');
	const isVtt = targetUrl.includes('.vtt');

	const headers: Record<string, string> = {
		'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		'Referer': 'https://rezka.ag/'
	};

	const clientRange = request.headers.get('range');
	if (clientRange) {
		headers['range'] = clientRange;
	}

	try {
		const upstream = await fetch(targetUrl, {
			method: 'GET',
			headers,
			redirect: 'follow'
		});

		if (!upstream.ok && upstream.status !== 206) {
			return new Response(`Upstream error: ${upstream.status} ${upstream.statusText}`, { status: upstream.status });
		}

		const responseHeaders = new Headers();
		responseHeaders.set('Access-Control-Allow-Origin', '*');
		responseHeaders.set('Accept-Ranges', 'bytes');

		if (isVtt) {
			responseHeaders.set('Content-Type', 'text/vtt; charset=utf-8');
			responseHeaders.set('Cache-Control', 'public, max-age=86400');
		} else if (isM3u8) {
			responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
			responseHeaders.set('Cache-Control', 'no-cache');
		} else if (isTs) {
			responseHeaders.set('Content-Type', 'video/mp2t');
			responseHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
		} else {
			responseHeaders.set('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
			responseHeaders.set('Cache-Control', 'public, max-age=86400');
		}

		// Rewrite M3U8 manifest relative segment paths
		if (isM3u8) {
			const text = await upstream.text();
			const finalUrl = upstream.url || targetUrl;
			const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/'));
			const rewritten = text.split('\n').map((line) => {
				const trimmed = line.trim();
				if (trimmed && !trimmed.startsWith('#')) {
					const segmentFullUrl = trimmed.startsWith('http')
						? trimmed
						: `${baseUrl}/${trimmed.replace(/^\.\//, '')}`;
					return `/api/proxy/video?url=${encodeURIComponent(segmentFullUrl)}`;
				}
				return line;
			}).join('\n');

			return new Response(rewritten, {
				status: upstream.status,
				headers: responseHeaders
			});
		}

		if (upstream.headers.has('content-length')) {
			responseHeaders.set('Content-Length', upstream.headers.get('content-length')!);
		}
		if (upstream.headers.has('content-range')) {
			responseHeaders.set('Content-Range', upstream.headers.get('content-range')!);
		}

		// Native zero-copy stream forwarding (Bun/SvelteKit)
		return new Response(upstream.body, {
			status: upstream.status,
			headers: responseHeaders
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Proxy connection failed';
		return new Response('Proxy error: ' + message, { status: 502 });
	}
};
