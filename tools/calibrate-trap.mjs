import puppeteer from 'puppeteer';
import fs from 'fs';

// Calibration: render full hexagon.png rotated 30° on a canvas,
// then render trap-a.png and trap-b.png, find exact position/size
// where they match the top/bottom halves.

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 10000 });

const result = await page.evaluate(() => {
  return new Promise((resolve) => {
    const hexImg = new Image();
    hexImg.crossOrigin = 'anonymous';
    hexImg.onload = () => {
      const trapAImg = new Image();
      trapAImg.crossOrigin = 'anonymous';
      trapAImg.onload = () => {
        const trapBImg = new Image();
        trapBImg.crossOrigin = 'anonymous';
        trapBImg.onload = () => {
          // Draw full hex rotated 30° on reference canvas
          const refSize = 600;
          const ref = document.createElement('canvas');
          ref.width = refSize;
          ref.height = refSize;
          const rctx = ref.getContext('2d');
          rctx.translate(refSize / 2, refSize / 2);
          rctx.rotate(30 * Math.PI / 180);
          const drawSize = 400; // render hex at 400px
          rctx.drawImage(hexImg, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
          rctx.setTransform(1, 0, 0, 1, 0, 0);

          const refData = rctx.getImageData(0, 0, refSize, refSize);

          // Now find: what w, h, x, y for trap-a.png makes bottom half match?
          // The trap PNG has aspect ratio ~2:1 (740x370)
          // We need to find the render width W such that the trap image
          // overlaid at position (x, y) with size (W, W/2) matches the bottom half

          // Try different widths
          const aspect = trapAImg.width / trapAImg.height; // ~2

          function tryOverlay(trapImg, w, x, y, half) {
            const test = document.createElement('canvas');
            test.width = refSize;
            test.height = refSize;
            const tctx = test.getContext('2d');
            const h = w / aspect;
            tctx.drawImage(trapImg, x, y, w, h);
            const testData = tctx.getImageData(0, 0, refSize, refSize);

            // Compare pixels where BOTH have alpha > 0
            let matches = 0;
            let mismatches = 0;
            const startY = half === 'bottom' ? Math.floor(refSize / 2) : 0;
            const endY = half === 'bottom' ? refSize : Math.floor(refSize / 2);

            for (let py = startY; py < endY; py++) {
              for (let px = 0; px < refSize; px++) {
                const idx = (py * refSize + px) * 4;
                const refA = refData.data[idx + 3];
                const testA = testData.data[idx + 3];
                if (refA > 10 && testA > 10) {
                  const dr = Math.abs(refData.data[idx] - testData.data[idx]);
                  const dg = Math.abs(refData.data[idx + 1] - testData.data[idx + 1]);
                  const db = Math.abs(refData.data[idx + 2] - testData.data[idx + 2]);
                  if (dr + dg + db < 30) matches++;
                  else mismatches++;
                } else if (refA > 10 && testA <= 10) {
                  mismatches++; // ref has pixel but test doesn't
                }
              }
            }
            return { matches, mismatches, score: matches / (matches + mismatches + 1) };
          }

          // Binary search for best width for trap A (bottom half)
          let bestW = 0, bestX = 0, bestY = 0, bestScore = 0;
          for (let w = 300; w <= 600; w += 10) {
            const h = w / aspect;
            const x = (refSize - w) / 2;
            const y = refSize / 2 - h * 0.02; // slight offset
            const { score } = tryOverlay(trapAImg, w, x, y, 'bottom');
            if (score > bestScore) {
              bestScore = score;
              bestW = w;
              bestX = x;
              bestY = y;
            }
          }
          // Fine tune
          for (let w = bestW - 15; w <= bestW + 15; w += 1) {
            for (let dy = -10; dy <= 10; dy += 1) {
              const h = w / aspect;
              const x = (refSize - w) / 2;
              const y = refSize / 2 + dy;
              const { score } = tryOverlay(trapAImg, w, x, y, 'bottom');
              if (score > bestScore) {
                bestScore = score;
                bestW = w;
                bestX = x;
                bestY = y;
              }
            }
          }

          // Compute multipliers relative to drawSize (400)
          const wMult = bestW / drawSize;
          const hMult = (bestW / aspect) / drawSize;
          const xOff = (bestX - (refSize / 2 - bestW / 2)) / drawSize;
          const yOff = (bestY - refSize / 2) / drawSize;

          // Same for trap B (top half)
          let bestW2 = 0, bestX2 = 0, bestY2 = 0, bestScore2 = 0;
          for (let w = 300; w <= 600; w += 10) {
            const h = w / aspect;
            const x = (refSize - w) / 2;
            const y = refSize / 2 - h + h * 0.02;
            const { score } = tryOverlay(trapBImg, w, x, y, 'top');
            if (score > bestScore2) {
              bestScore2 = score;
              bestW2 = w;
              bestX2 = x;
              bestY2 = y;
            }
          }
          for (let w = bestW2 - 15; w <= bestW2 + 15; w += 1) {
            for (let dy = -10; dy <= 10; dy += 1) {
              const h = w / aspect;
              const x = (refSize - w) / 2;
              const y = refSize / 2 - h + dy;
              const { score } = tryOverlay(trapBImg, w, x, y, 'top');
              if (score > bestScore2) {
                bestScore2 = score;
                bestW2 = w;
                bestX2 = x;
                bestY2 = y;
              }
            }
          }

          const wMult2 = bestW2 / drawSize;
          const hMult2 = (bestW2 / aspect) / drawSize;
          const xOff2 = (bestX2 - (refSize / 2 - bestW2 / 2)) / drawSize;
          const yOff2 = (bestY2 - (refSize / 2 - bestW2 / aspect)) / drawSize;

          resolve({
            trapA: { w: bestW, x: bestX, y: bestY, score: bestScore, wMult, hMult, xOff, yOff },
            trapB: { w: bestW2, x: bestX2, y: bestY2, score: bestScore2, wMult: wMult2, hMult: hMult2, xOff: xOff2, yOff: yOff2 },
            drawSize,
            refSize,
          });
        };
        trapBImg.src = '/img/trapezoid-b.png';
      };
      trapAImg.src = '/img/trapezoid-a.png';
    };
    hexImg.src = '/img/hexagon.png';
  });
});

console.log('Calibration results:');
console.log(JSON.stringify(result, null, 2));

await browser.close();
