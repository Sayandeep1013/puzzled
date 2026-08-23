/**
 * Builds the app's launcher icons from the bear.
 *
 * The project shipped with Expo's template icon — the blue chevron — as its
 * launcher icon, so the app on the home screen looked like a scaffolded
 * project rather than like Puzzled. The bear is already the app's mark
 * everywhere it matters (the splash window, Home's mascot, the Profile tab), so
 * the icon is composed from that rather than invented separately.
 *
 * Generated PNGs are committed, so a normal install and a normal EAS build
 * never run this script and never need `sharp`. Run it only when the mark or
 * the palette changes:
 *
 *   npm i --no-save sharp
 *   node scripts/build-icons.mjs
 *
 * Source of truth is `assets/art/bear@3x.png` (the same 672px art the splash
 * uses) plus the sky/grass values from `src/shared/tokens.ts`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BEAR = path.join(root, 'assets/art/bear@3x.png');
const OUT = path.join(root, 'assets/images');

/** From `backgrounds` in src/shared/tokens.ts — the same sky the splash uses. */
const SKY = '#8AE3F5';
const SKY_LIGHT = '#BFF0FA';
const GRASS = '#A8D95C';

/**
 * Fraction of its square canvas the bear's opaque pixels actually span.
 *
 * The art is drawn with transparent padding, so a bear laid out at N points is
 * visually about 0.82N wide. Every size below is chosen against the *visible*
 * bear, not the canvas, which is what makes the adaptive-icon safe zone maths
 * come out right. Measured on device; see `src/shared/splash.ts`.
 */
const BEAR_VISIBLE_RATIO = 0.8202;

/** Sky above, one soft grass hill below — the app's own background, compressed. */
function backgroundSvg(size) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
       <defs>
         <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0" stop-color="${SKY}"/>
           <stop offset="1" stop-color="${SKY_LIGHT}"/>
         </linearGradient>
       </defs>
       <rect width="${size}" height="${size}" fill="url(#sky)"/>
       <ellipse cx="${size / 2}" cy="${size * 1.09}" rx="${size * 0.74}" ry="${size * 0.41}"
                fill="${GRASS}"/>
     </svg>`,
  );
}

async function bearLayer(canvasPx) {
  return sharp(BEAR).resize(canvasPx, canvasPx, { fit: 'contain', background: '#00000000' }).toBuffer();
}

/**
 * The full-bleed icon: iOS, the web favicon, and Android's legacy square.
 * The bear stands on the hill rather than floating in the middle of the sky.
 */
async function buildIcon() {
  const size = 1024;
  const bearCanvas = Math.round(size * 0.66);
  const top = Math.round(size * 0.15);
  const left = Math.round((size - bearCanvas) / 2);

  await sharp(backgroundSvg(size))
    .composite([{ input: await bearLayer(bearCanvas), top, left }])
    .png()
    .toFile(path.join(OUT, 'icon.png'));

  // 48px, which is what the manifest already referenced.
  await sharp(path.join(OUT, 'icon.png')).resize(48, 48).png().toFile(path.join(OUT, 'favicon.png'));
}

/**
 * Android's adaptive icon: two layers the launcher masks to whatever shape the
 * device uses (circle, squircle, teardrop).
 *
 * Only the middle 72 of 108 units survive every mask, so the *visible* bear is
 * sized against that safe circle rather than against the canvas — a bear scaled
 * to fill the canvas would lose its ears and feet on a round mask, which is the
 * same mistake the splash icon made once (see `src/shared/splash.test.ts`).
 */
async function buildAdaptive() {
  const size = 512;
  const SAFE_FRACTION = 72 / 108;
  // Fill 88% of the safe circle, then undo the art's transparent padding.
  const visibleTarget = size * SAFE_FRACTION * 0.88;
  const bearCanvas = Math.round(visibleTarget / BEAR_VISIBLE_RATIO);
  const offset = Math.round((size - bearCanvas) / 2);

  await sharp({
    create: { width: size, height: size, channels: 4, background: '#00000000' },
  })
    .composite([{ input: await bearLayer(bearCanvas), top: offset, left: offset }])
    .png()
    .toFile(path.join(OUT, 'android-icon-foreground.png'));

  await sharp(backgroundSvg(size)).png().toFile(path.join(OUT, 'android-icon-background.png'));

  /*
   * Themed icons are a single-colour stencil the launcher tints itself, so this
   * layer is the bear's *silhouette* — its alpha channel painted flat black —
   * not a greyscale copy of the artwork. A tinted photo of a bear would come
   * out as a muddy blob.
   */
  const mono = 432;
  const monoCanvas = Math.round((mono * SAFE_FRACTION * 0.88) / BEAR_VISIBLE_RATIO);
  const monoOffset = Math.round((mono - monoCanvas) / 2);
  const alpha = await sharp(await bearLayer(monoCanvas)).ensureAlpha().extractChannel('alpha').toBuffer();
  const stencil = await sharp({
    create: { width: monoCanvas, height: monoCanvas, channels: 3, background: '#000000' },
  })
    .joinChannel(alpha)
    .png()
    .toBuffer();

  await sharp({ create: { width: mono, height: mono, channels: 4, background: '#00000000' } })
    .composite([{ input: stencil, top: monoOffset, left: monoOffset }])
    .png()
    .toFile(path.join(OUT, 'android-icon-monochrome.png'));
}

if (!fs.existsSync(BEAR)) {
  throw new Error(`Missing source art: ${BEAR}`);
}

await buildIcon();
await buildAdaptive();

for (const name of [
  'icon.png',
  'favicon.png',
  'android-icon-foreground.png',
  'android-icon-background.png',
  'android-icon-monochrome.png',
]) {
  const file = path.join(OUT, name);
  const { width, height } = await sharp(file).metadata();
  console.log(`${name.padEnd(32)} ${width}x${height}  ${fs.statSync(file).size} bytes`);
}
