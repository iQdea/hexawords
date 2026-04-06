import puppeteer from 'puppeteer';
import fs from 'fs';

const size = 512;
const pad = 60;

// Flat-top hex corners relative to center, scaled to fit
const hexR = (size - pad * 2) / 2;
const corners = [];
for (let i = 0; i < 6; i++) {
  const angle = (Math.PI / 180) * (60 * i);
  corners.push({
    x: size / 2 + hexR * Math.cos(angle),
    y: size / 2 + hexR * Math.sin(angle),
  });
}

// Upper half trapezoid (variant A): corners 3,4,5,0
// corner 0 = right, 1 = bottom-right, 2 = bottom-left, 3 = left, 4 = top-left, 5 = top-right
// Upper half = flat bottom (3→0) + two sides going up + short top (4→5)
const trapA = [corners[3], corners[4], corners[5], corners[0]];

// Lower half trapezoid (variant B): corners 0,1,2,3
const trapB = [corners[0], corners[1], corners[2], corners[3]];

function makeSVG(points, filename) {
  // Compute bounding box
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const maxX = Math.max(...xs) + pad;
  const maxY = Math.max(...ys) + pad;
  const w = maxX - minX;
  const h = maxY - minY;

  const pts = points.map(p => `${p.x - minX + pad / 2},${p.y - minY + pad / 2}`).join(' ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="150%" height="150%">
        <feDropShadow dx="4" dy="6" stdDeviation="12" flood-color="rgba(0,0,0,0.25)" />
      </filter>
      <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.95)" />
        <stop offset="40%" stop-color="rgba(240,245,250,0.85)" />
        <stop offset="100%" stop-color="rgba(210,220,235,0.75)" />
      </linearGradient>
      <linearGradient id="innerGlow" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.6)" />
        <stop offset="100%" stop-color="rgba(255,255,255,0)" />
      </linearGradient>
    </defs>
    <polygon points="${pts}" fill="url(#glassGrad)" stroke="rgba(160,170,190,0.6)" stroke-width="2.5" stroke-linejoin="round" filter="url(#shadow)" />
    <polygon points="${pts}" fill="url(#innerGlow)" stroke="none" />
  </svg>`;
}

async function svgToPng(svgContent, outputPath) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const dataUrl = `data:text/html,<html><body style="margin:0;background:transparent">${encodeURIComponent(svgContent)}</body></html>`;
  await page.setViewport({ width: 600, height: 400 });
  await page.goto(dataUrl, { waitUntil: 'networkidle0' });

  // Get SVG element bounds
  const dims = await page.evaluate(() => {
    const svg = document.querySelector('svg');
    return { width: svg.width.baseVal.value, height: svg.height.baseVal.value };
  });
  await page.setViewport({ width: Math.ceil(dims.width), height: Math.ceil(dims.height) });
  await page.screenshot({ path: outputPath, omitBackground: true });
  await browser.close();
}

const svgA = makeSVG(trapA, 'trapezoid-a');
const svgB = makeSVG(trapB, 'trapezoid-b');

fs.writeFileSync('/tmp/trap_a.svg', svgA);
fs.writeFileSync('/tmp/trap_b.svg', svgB);

await svgToPng(svgA, '/home/qdea/hobby/apps/web/public/img/trapezoid-a.png');
console.log('Generated trapezoid-a.png');
await svgToPng(svgB, '/home/qdea/hobby/apps/web/public/img/trapezoid-b.png');
console.log('Generated trapezoid-b.png');
