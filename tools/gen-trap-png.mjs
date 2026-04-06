import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 10000 });

// Use canvas to rotate hexagon.png 30deg then split in half
await page.evaluate(() => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = img.width; // 512
      const angle = 30 * Math.PI / 180;
      const canvasSize = Math.ceil(size * (Math.cos(angle) + Math.sin(angle)) + 40); // exact rotated bbox + shadow padding
      const cx = canvasSize / 2;
      const cy = canvasSize / 2;

      // Draw rotated hex on full canvas
      const full = document.createElement('canvas');
      full.width = canvasSize;
      full.height = canvasSize;
      const fctx = full.getContext('2d');
      fctx.translate(cx, cy);
      fctx.rotate(30 * Math.PI / 180);
      fctx.drawImage(img, -size / 2, -size / 2, size, size);
      fctx.setTransform(1, 0, 0, 1, 0, 0);

      // Top half → trapezoid B
      const topCanvas = document.createElement('canvas');
      topCanvas.width = canvasSize;
      topCanvas.height = Math.ceil(canvasSize / 2);
      const tctx = topCanvas.getContext('2d');
      tctx.drawImage(full, 0, 0, canvasSize, canvasSize / 2, 0, 0, canvasSize, canvasSize / 2);

      // Bottom half → trapezoid A
      const botCanvas = document.createElement('canvas');
      botCanvas.width = canvasSize;
      botCanvas.height = Math.ceil(canvasSize / 2);
      const bctx = botCanvas.getContext('2d');
      bctx.drawImage(full, 0, canvasSize / 2, canvasSize, canvasSize / 2, 0, 0, canvasSize, canvasSize / 2);

      window._trapA = botCanvas.toDataURL('image/png');
      window._trapB = topCanvas.toDataURL('image/png');
      resolve();
    };
    img.src = '/img/hexagon.png';
  });
});

// Extract data URLs and save
const trapA = await page.evaluate(() => window._trapA);
const trapB = await page.evaluate(() => window._trapB);

import fs from 'fs';
fs.writeFileSync(
  '/home/qdea/hobby/apps/web/public/img/trapezoid-a.png',
  Buffer.from(trapA.replace(/^data:image\/png;base64,/, ''), 'base64')
);
fs.writeFileSync(
  '/home/qdea/hobby/apps/web/public/img/trapezoid-b.png',
  Buffer.from(trapB.replace(/^data:image\/png;base64,/, ''), 'base64')
);

console.log('trapezoid-a.png (bottom half) saved');
console.log('trapezoid-b.png (top half) saved');

await browser.close();
