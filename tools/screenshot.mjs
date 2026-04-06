import puppeteer from 'puppeteer';

const url = process.argv[2] || 'http://localhost:5173';
const output = process.argv[3] || '/tmp/screenshot.png';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
await new Promise(r => setTimeout(r, 2000)); // wait for animations
await page.screenshot({ path: output, fullPage: false });
console.log(`Screenshot saved to ${output}`);
await browser.close();
