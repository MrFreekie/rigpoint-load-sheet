// Renders public/favicon.svg into the PNG icons the web manifest needs, using
// Playwright's Chromium (already a dev dependency). Run after changing the SVG:
//   node scripts/make-icons.mjs
// The PNGs are committed, so builds do not need a browser.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');

// Maskable icons are cropped to a circle by some launchers: keep the artwork in the
// central 80 % "safe zone" on a full-bleed background.
const maskable = svg
  .replace('<rect width="512" height="512" rx="96" fill="#0b2545"/>', '<rect width="512" height="512" fill="#0b2545"/><g transform="translate(51.2 51.2) scale(0.8)">')
  .replace('</svg>', '</g></svg>');

const outputs = [
  { file: 'icon-192.png', size: 192, src: svg },
  { file: 'icon-512.png', size: 512, src: svg },
  { file: 'icon-maskable-512.png', size: 512, src: maskable },
  { file: 'apple-touch-icon.png', size: 180, src: maskable },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, src } of outputs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${src}`,
  );
  await page.screenshot({ path: fileURLToPath(new URL(`../public/${file}`, import.meta.url)), omitBackground: true });
  console.log(`public/${file}`);
}
await browser.close();
