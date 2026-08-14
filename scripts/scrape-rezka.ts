import puppeteer from 'puppeteer';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://srghma@127.0.0.1:55432/rezka';
const sql = postgres(DATABASE_URL);

const TARGET_URL = 'https://rezka.ag/series/thriller/646-vo-vse-tyazhkie-2008-latest.html';
const CHROME_WS_URL = 'ws://127.0.0.1:9223/devtools/browser';

async function main() {
	console.log('🔗 Connecting to existing Chrome at', CHROME_WS_URL);
	
	// Fetch browser endpoint from remote debugging port if needed
	let browser;
	try {
		const versionResp = await fetch('http://127.0.0.1:9223/json/version');
		const versionData = await versionResp.json();
		browser = await puppeteer.connect({
			browserWSEndpoint: versionData.webSocketDebuggerUrl,
			defaultViewport: null
		});
	} catch (e) {
		console.error('Failed to connect via HTTP version URL, trying direct WS URL:', e);
		browser = await puppeteer.connect({
			browserWSEndpoint: CHROME_WS_URL,
			defaultViewport: null
		});
	}

	const page = await browser.newPage();
	console.log(`🌐 Navigating to ${TARGET_URL}...`);
	
	await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });
	
	// Scroll to bottom to ensure dynamic elements/scripts load
	await page.evaluate(async () => {
		await new Promise((resolve) => {
			let totalHeight = 0;
			const distance = 300;
			const timer = setInterval(() => {
				const scrollHeight = document.body.scrollHeight;
				window.scrollBy(0, distance);
				totalHeight += distance;
				if (totalHeight >= scrollHeight) {
					clearInterval(timer);
					resolve(true);
				}
			}, 100);
		});
	});

	await page.sleep ? await page.sleep(2000) : new Promise(r => setTimeout(r, 2000));

	const html = await page.content();
	
	// Extract canonical URL or fallback to target URL
	const canonicalUrl = await page.evaluate(() => {
		const link = document.querySelector('link[rel="canonical"]');
		return link ? (link as HTMLLinkElement).href : window.location.href;
	}) || TARGET_URL;

	console.log(`📄 Page content fetched. Canonical URL: ${canonicalUrl}. Size: ${html.length} bytes.`);

	console.log('💾 Saving into raw_cached_pages database table...');
	await sql`
		INSERT INTO raw_cached_pages (canonical_url, html, fetched_at)
		VALUES (${canonicalUrl}, ${html}, NOW())
		ON CONFLICT (canonical_url) DO UPDATE
		SET html = EXCLUDED.html, fetched_at = NOW()
	`;

	console.log('✅ Page successfully cached in DB!');
	await page.close();
	await sql.end();
	process.exit(0);
}

main().catch((err) => {
	console.error('❌ Error scraping page:', err);
	process.exit(1);
});
