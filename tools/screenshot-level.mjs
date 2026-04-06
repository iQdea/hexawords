import puppeteer from 'puppeteer';

const level = process.argv[2] || '1';
const output = process.argv[3] || '/tmp/screenshot_level.png';
const width = parseInt(process.argv[4] || '1600');
const height = parseInt(process.argv[5] || '1000');

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width, height });

await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });
await new Promise(r => setTimeout(r, 1000));

await page.evaluate(() => {
  const links = document.querySelectorAll('a, button, [role="button"]');
  for (const el of links) {
    if (el.textContent.includes('Кампания')) { el.click(); return; }
  }
  const a = document.querySelector('a[href*="campaign"]');
  if (a) a.click();
});
await new Promise(r => setTimeout(r, 2000));

await page.evaluate((lvl) => {
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    const numEl = btn.querySelector('.level-num');
    if (numEl && numEl.textContent.trim() === lvl) { btn.click(); return; }
  }
}, level);
await new Promise(r => setTimeout(r, 3000));

await page.screenshot({ path: output, fullPage: false });
console.log(`Screenshot saved to ${output}`);
await browser.close();
