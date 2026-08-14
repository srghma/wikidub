import { json, type RequestHandler } from '@sveltejs/kit';
import { decodeVideoURL, decodeSubtitleURL } from '$lib/server/rezka/extract';
import puppeteer from 'puppeteer';

let cachedBrowser: any = null;

async function getChromeBrowser() {
	if (cachedBrowser && cachedBrowser.connected) {
		return cachedBrowser;
	}
	try {
		const versionResp = await fetch('http://127.0.0.1:9223/json/version');
		const versionData = await versionResp.json();
		cachedBrowser = await puppeteer.connect({
			browserWSEndpoint: versionData.webSocketDebuggerUrl,
			defaultViewport: null
		});
		return cachedBrowser;
	} catch (e) {
		return null;
	}
}

export const GET: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id') || '646';
	const translator_id = url.searchParams.get('translator_id') || '238';
	const season = url.searchParams.get('season') || '1';
	const episode = url.searchParams.get('episode') || '1';

	try {
		const browser = await getChromeBrowser();
		if (browser) {
			const pages = await browser.pages();
			let targetPage = pages.find((p: any) => p.url().includes('rezka.ag'));
			if (!targetPage) {
				targetPage = await browser.newPage();
				await targetPage.goto('https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008-latest.html', { waitUntil: 'domcontentloaded' });
			}

			const result = await targetPage.evaluate(async (pId: string, tId: string, sId: string, eId: string) => {
				const formData = new URLSearchParams();
				formData.append('id', pId);
				formData.append('translator_id', tId);
				formData.append('season', sId);
				formData.append('episode', eId);
				formData.append('action', 'get_stream');

				const res = await fetch('/ajax/get_cdn_series/?t=' + Date.now(), {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
						'X-Requested-With': 'XMLHttpRequest'
					},
					body: formData.toString()
				});
				return await res.json();
			}, id, translator_id, season, episode);

			if (result && result.success) {
				const streams = decodeVideoURL(result.url);
				const subtitles = decodeSubtitleURL(result.subtitle, result.subtitle_lns);
				return json({
					success: true,
					streams,
					subtitles
				});
			}
		}

		return json({
			success: false,
			error: 'Failed to fetch CDN stream from browser session'
		}, { status: 400 });
	} catch (err: any) {
		return json({
			success: false,
			error: err?.message || 'Internal error'
		}, { status: 500 });
	}
};
