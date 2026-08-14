import type { RequestHandler } from '@sveltejs/kit';
import https from 'node:https';
import http from 'node:http';
import { Readable } from 'node:stream';

// High performance HTTP/HTTPS persistent connection pool
const httpsAgent = new https.Agent({
	rejectUnauthorized: false,
	keepAlive: true,
	maxSockets: 100,
	maxFreeSockets: 30,
	timeout: 60000,
	scheduling: 'lifo'
});

const httpAgent = new http.Agent({
	keepAlive: true,
	maxSockets: 100,
	maxFreeSockets: 30,
	timeout: 60000,
	scheduling: 'lifo'
});

function fetchStreamWithRedirects(targetUrl: string, clientRange: string | null, redirectCount = 0): Promise<Response> {
	return new Promise((resolve) => {
		if (redirectCount > 5) {
			return resolve(new Response('Too many redirects', { status: 502 }));
		}

		const parsedUrl = new URL(targetUrl);
		const client = parsedUrl.protocol === 'https:' ? https : http;
		const agent = parsedUrl.protocol === 'https:' ? httpsAgent : httpAgent;

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
			agent
		}, (res) => {
			const status = res.statusCode || 200;

			// Handle 301/302/307/308 redirects immediately
			if ((status === 301 || status === 302 || status === 307 || status === 308) && res.headers.location) {
				const nextUrl = new URL(res.headers.location, targetUrl).toString();
				res.resume();
				return resolve(fetchStreamWithRedirects(nextUrl, clientRange, redirectCount + 1));
			}

			const isM3u8 = targetUrl.includes('.m3u8') || (res.headers['content-type'] && res.headers['content-type'].includes('mpegurl'));
			const isVtt = targetUrl.includes('.vtt') || (res.headers['content-type'] && res.headers['content-type'].includes('vtt'));
			const isTs = targetUrl.includes('.ts');

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
				responseHeaders.set('Content-Type', res.headers['content-type'] || 'video/mp4');
				responseHeaders.set('Cache-Control', 'public, max-age=86400');
			}

			// For M3U8 manifests, rewrite relative segment paths
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

			// For small .ts segments (~280KB) and .vtt files, buffer in RAM for instant 1ms local transfer
			if (isTs || isVtt) {
				const chunks: Buffer[] = [];
				res.on('data', (chunk) => {
					chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
				});
				res.on('end', () => {
					const fullBuffer = Buffer.concat(chunks);
					responseHeaders.set('Content-Length', String(fullBuffer.length));
					resolve(new Response(fullBuffer, {
						status,
						headers: responseHeaders
					}));
				});
				return;
			}

			// For large direct mp4 files, stream with range support
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
