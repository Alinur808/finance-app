// Renders public/icon.svg to the PNG sizes the PWA manifest and iOS need.
// Run once: node scripts/make-icons.cjs  (uses the Playwright Chromium)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const pub = path.join(__dirname, '..', 'public');
const svg = fs.readFileSync(path.join(pub, 'icon.svg'), 'utf8');
const targets = [
  ['pwa-192x192.png', 192, 0],
  ['pwa-512x512.png', 512, 0],
  ['maskable-512x512.png', 512, 0.1], // extra safe-zone padding for Android masks
  ['apple-touch-icon.png', 180, 0],
  ['favicon-32x32.png', 32, 0],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, size, pad] of targets) {
    await page.setViewportSize({ width: size, height: size });
    const inner = Math.round(size * (1 - pad * 2));
    await page.setContent(
      `<html><body style="margin:0;background:#083f2b;display:grid;place-items:center;width:${size}px;height:${size}px">` +
        `<div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
    );
    await page.screenshot({ path: path.join(pub, name), omitBackground: false });
    console.log('wrote', name);
  }
  await browser.close();
})();
