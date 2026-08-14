import type { RequestHandler } from '@sveltejs/kit';
import https from 'node:https';
import http from 'node:http';
import { Readable } from 'node:stream';

const httpsAgent = new https.Agent({
	rejectUnauthorized: false
});

function fetchStreamWithRedirects(targetUrl: string, clientRange: string | null, redirectCount = 0): Promise<Response> {
	return new Promise((resolve) => {
		if (redirectCount > 5) {
			return resolve(new Response('Too many redirects', { status: 502 }));
		}

		const parsedUrl = new URL(targetUrl);
		const client = parsedUrl.protocol === 'https:' ? https : http;

		const headers: Record<string, string> = {
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			'Referer': 'https://rezka.ag/'
		};

		if (clientRange) {
			headers['range'] = clientRange;
		}

		const req = client.request(targetUrl, {
			method: 'GET',
			headers,
			agent: parsedUrl.protocol === 'https:' ? httpsAgent : undefined
		}, (res) => {
			const status = res.statusCode || 200;

			// Handle 301/302 redirects
			if ((status === 301 || status === 302 || status === 307 || status === 308) && res.headers.location) {
				const nextUrl = new URL(res.headers.location, targetUrl).toString();
				res.resume();
				return resolve(fetchStreamWithRedirects(nextUrl, clientRange, redirectCount + 1));
			}

			const isM3u8 = targetUrl.includes('.m3u8') || (res.headers['content-type'] && res.headers['content-type'].includes('mpegurl'));
			const isVtt = targetUrl.includes('.vtt') || (res.headers['content-type'] && res.headers['content-type'].includes('vtt'));

			const responseHeaders = new Headers();
			responseHeaders.set('Access-Control-Allow-Origin', '*');
			responseHeaders.set('Accept-Ranges', 'bytes');

			if (isVtt) {
				responseHeaders.set('Content-Type', 'text/vtt; charset=utf-8');
			} else if (isM3u8) {
				responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
			} else if (targetUrl.includes('.ts')) {
				responseHeaders.set('Content-Type', 'video/mp2t');
			} else {
				responseHeaders.set('Content-Type', res.headers['content-type'] || 'video/mp4');
			}

			// Rewrite M3U8 manifest relative segment paths
			if (isM3u8) {
				let buffer = '';
				res.setEncoding('utf-8');
				res.on('data', (chunk) => {
					buffer += chunk;
				});
				res.on('end', () => {
					const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/'));
					const rewritten = buffer.split('\n').map((line) => {
						const trimmed = line.trim();
						if (trimmed && !trimmed.startsWith('#')) {
							const segmentFullUrl = trimmed.startsWith('http')
								? trimmed
								: `${baseUrl}/${trimmed.replace(/^\.\//, '')}`;
							return `/api/proxy/video?url=${encodeURIComponent(segmentFullUrl)}`;
						}
						return line;
					}).join('\n');

					resolve(new Response(rewritten, {
						status,
						headers: responseHeaders
					}));
				});
				return;
			}

			if (res.headers['content-length']) {
				responseHeaders.set('Content-Length', String(res.headers['content-length']));
			}
			if (res.headers['content-range']) {
				responseHeaders.set('Content-Range', String(res.headers['content-range']));
			}

			const webStream = Readable.toWeb(res) as unknown as ReadableStream;

			resolve(new Response(webStream, {
				status,
				headers: responseHeaders
			}));
		});

		req.on('error', (err) => {
			resolve(new Response('Proxy connection error: ' + err.message, { status: 502 }));
		});

		req.end();
	});
}

export const GET: RequestHandler = async ({ url, request }) => {
	const targetUrl = url.searchParams.get('url');
	if (!targetUrl) {
		return new Response('Missing url parameter', { status: 400 });
	}

	const clientRange = request.headers.get('range');
	return fetchStreamWithRedirects(targetUrl, clientRange);
};
