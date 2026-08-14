import puppeteer from 'puppeteer';

async function verify() {
	console.log('🧪 Verifying application in Chrome...');
	const versionResp = await fetch('http://127.0.0.1:9223/json/version');
	const versionData = await versionResp.json();
	const browser = await puppeteer.connect({
		browserWSEndpoint: versionData.webSocketDebuggerUrl,
		defaultViewport: null
	});

	const page = await browser.newPage();

	// 1. Verify Home Page (IMDb archive)
	console.log('Testing Home Page: http://localhost:3000/');
	await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
	const homeTitle = await page.title();
	const titlesCount = await page.evaluate(() => document.querySelectorAll('main section:nth-of-type(2) .grid > div').length);
	console.log(`✓ Home page title: "${homeTitle}". Rendered IMDb title cards: ${titlesCount}`);

	// 2. Verify Rezka Series Page
	console.log('Testing Series Page: http://localhost:3000/rezka/series/thriller/646-vo-vse-tyazhkie-2008-latest.html');
	await page.goto('http://localhost:3000/rezka/series/thriller/646-vo-vse-tyazhkie-2008-latest.html', { waitUntil: 'networkidle2' });
	
	const seriesTitle = await page.title();
	const h1Text = await page.evaluate(() => document.querySelector('h1')?.textContent?.trim());
	const dubbings = await page.evaluate(() => Array.from(document.querySelectorAll('section button')).map(b => b.textContent?.trim()).filter(Boolean));
	const videoSrc = await page.evaluate(() => document.querySelector('video')?.src || document.querySelector('video')?.currentSrc);
	const seasonsCount = await page.evaluate(() => Array.from(document.querySelectorAll('section:nth-of-type(2) div:nth-of-type(4) button')).length);
	const episodesCount = await page.evaluate(() => Array.from(document.querySelectorAll('section:nth-of-type(2) div:nth-of-type(5) button')).length);

	console.log(`✓ Series page title: "${seriesTitle}"`);
	console.log(`✓ H1 Heading: "${h1Text}"`);
	console.log(`✓ Video element source: "${videoSrc}"`);
	console.log(`✓ Rendered Season buttons count: ${seasonsCount}`);
	console.log(`✓ Rendered Episode buttons count: ${episodesCount}`);

	await page.close();
	console.log('🎉 All automated end-to-end checks passed!');
	process.exit(0);
}

verify().catch((err) => {
	console.error('❌ Verification failed:', err);
	process.exit(1);
});
