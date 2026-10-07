// Regenerates the PWA icons in icons/ from the sprig mark used in index.html.
// Run: CHROMIUM_PATH=/path/to/chrome node tools/make-icons.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'icons');

// Light-theme colors from styles.css (--bg, --branch, --leaf-1, --leaf-2, --berry).
const sprig = `
  <symbol id="leaf" viewBox="0 0 80 40"><path d="M0 20C18-2 58-4 80 20 58 44 18 42 0 20Z"/></symbol>
  <symbol id="sprig" viewBox="0 0 64 64">
    <path d="M32 60V14" fill="none" stroke="#5a4a36" stroke-width="2.5" stroke-linecap="round"/>
    <use href="#leaf" width="30" height="15" transform="translate(32 44) rotate(-35)" fill="#5d7340"/>
    <use href="#leaf" width="30" height="15" transform="translate(32 44) rotate(-145) scale(1 -1)" fill="#7f9658"/>
    <use href="#leaf" width="26" height="13" transform="translate(32 28) rotate(-40)" fill="#7f9658"/>
    <use href="#leaf" width="26" height="13" transform="translate(32 28) rotate(-140) scale(1 -1)" fill="#5d7340"/>
    <circle cx="32" cy="12" r="5" fill="#7d5a9c"/>
  </symbol>`;

/** The sprig's drawn area is centered near (32, 33.5) of its 64-unit box. */
const icon = ({ maskable }) => {
  const box = maskable ? 307 : 410; // maskable keeps the mark inside the 80% safe circle
  const x = (512 - box) / 2;
  const y = 256 - (33.5 / 64) * box;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>${sprig}</defs>
  <rect width="512" height="512" rx="${maskable ? 0 : 112}" fill="#f4efe4"/>
  <use href="#sprig" x="${x}" y="${y.toFixed(1)}" width="${box}" height="${box}"/>
</svg>
`;
};

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-192.png', size: 192, maskable: true },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
];

await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, 'icon.svg'), icon({ maskable: false }));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
for (const { file, size, maskable } of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${icon({ maskable })}`);
  await page.screenshot({ path: path.join(out, file), omitBackground: true });
}
await browser.close();
console.log(`Wrote ${targets.length + 1} icons to ${path.relative(root, out)}/`);
