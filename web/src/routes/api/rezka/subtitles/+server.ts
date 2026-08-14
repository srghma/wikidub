import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { rawCachedSubtitles } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import https from 'node:https';
import http from 'node:http';

const httpsAgent = new https.Agent({
	rejectUnauthorized: false
});

function fetchRemoteVtt(targetUrl: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const parsedUrl = new URL(targetUrl);
		const client = parsedUrl.protocol === 'https:' ? https : http;

		const req = client.request(targetUrl, {
			method: 'GET',
			headers: {
				'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Referer': 'https://rezka.ag/'
			},
			agent: parsedUrl.protocol === 'https:' ? httpsAgent : undefined
		}, (res) => {
			if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				const nextUrl = new URL(res.headers.location, targetUrl).toString();
				res.resume();
				return resolve(fetchRemoteVtt(nextUrl));
			}

			let buffer = '';
			res.setEncoding('utf-8');
			res.on('data', (chunk) => {
				buffer += chunk;
			});
			res.on('end', () => {
				resolve(buffer);
			});
			res.on('error', (err) => {
				reject(err);
			});
		});

		req.on('error', (err) => {
			reject(err);
		});

		req.end();
	});
}

export const GET: RequestHandler = async ({ url }) => {
	const targetUrl = url.searchParams.get('url');
	if (!targetUrl) {
		return new Response('Missing url parameter', { status: 400 });
	}

	try {
		// 1. Check database cache
		const cached = await db
			.select({
				id: rawCachedSubtitles.id,
				vttContent: rawCachedSubtitles.vttContent
			})
			.from(rawCachedSubtitles)
			.where(eq(rawCachedSubtitles.url, targetUrl))
			.limit(1);

		if (cached.length > 0) {
			return new Response(cached[0].vttContent, {
				status: 200,
				headers: {
					'Content-Type': 'text/vtt; charset=utf-8',
					'Access-Control-Allow-Origin': '*',
					'Cache-Control': 'public, max-age=86400',
					'X-Subtitle-Cache': 'HIT'
				}
			});
		}

		// 2. Fetch from remote CDN
		const vttContent = await fetchRemoteVtt(targetUrl);

		if (vttContent && vttContent.trim().length > 0) {
			// Save into database cache
			await db.insert(rawCachedSubtitles).values({
				url: targetUrl,
				vttContent
			}).onConflictDoUpdate({
				target: rawCachedSubtitles.url,
				set: { vttContent, fetchedAt: new Date() }
			});

			return new Response(vttContent, {
				status: 200,
				headers: {
					'Content-Type': 'text/vtt; charset=utf-8',
					'Access-Control-Allow-Origin': '*',
					'Cache-Control': 'public, max-age=86400',
					'X-Subtitle-Cache': 'MISS'
				}
			});
		}

		return new Response('Empty subtitle content', { status: 502 });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return new Response('Subtitle error: ' + message, { status: 500 });
	}
};
