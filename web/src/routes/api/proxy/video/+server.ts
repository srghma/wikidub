import type { RequestHandler } from '@sveltejs/kit';
import https from 'node:https';
import http from 'node:http';

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

			// Handle redirect
			if ((status === 301 || status === 302 || status === 307 || status === 308) && res.headers.location) {
				const nextUrl = new URL(res.headers.location, targetUrl).toString();
				res.resume();
				return resolve(fetchStreamWithRedirects(nextUrl, clientRange, redirectCount + 1));
			}

			const responseHeaders = new Headers();
			responseHeaders.set('Access-Control-Allow-Origin', '*');
			responseHeaders.set('Accept-Ranges', 'bytes');
			responseHeaders.set('Content-Type', res.headers['content-type'] || 'video/mp4');

			if (res.headers['content-length']) {
				responseHeaders.set('Content-Length', String(res.headers['content-length']));
			}
			if (res.headers['content-range']) {
				responseHeaders.set('Content-Range', String(res.headers['content-range']));
			}

			const webStream = new ReadableStream({
				start(controller) {
					res.on('data', (chunk) => {
						controller.enqueue(chunk);
					});
					res.on('end', () => {
						controller.close();
					});
					res.on('error', (err) => {
						controller.error(err);
					});
				},
				cancel() {
					res.destroy();
				}
			});

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
