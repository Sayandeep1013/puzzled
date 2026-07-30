/**
 * Composites the splash screen: the same meadow Home uses, with the bear placed
 * where Home draws it.
 *
 * Why the full scene rather than a bare bear on a colour: expo-splash-screen can
 * `cover`-fit a single image, so using Home's own background means the two are
 * pixel-identical behind the mascot. The bear is then positioned to match Home's
 * layout, and the launch reads as the app opening rather than as one screen being
 * replaced by another.
 *
 * Run after changing the background, the mascot, or Home's bear placement:
 *
 *   npm i --no-save sharp
 *   node scripts/build-splash.mjs
 *
 * `sharp` is deliberately not a project dependency — the output is committed, so
 * install and EAS build never touch this path.
 */

import fs from 'node:fs';
import process from 'node:process';

const BACKGROUND = 'assets/backgrounds/home.png';
const BEAR = 'assets/art/bear@3x.png';
const OUT = 'assets/images/splash.png';

/**
 * Where the bear sits, as fractions of the background.
 *
 * Derived from Home's layout: a top bar, the wordmark, then the mascot centred in
 * the space left above the buttons. That lands its centre a little above the
 * midpoint, and its width is close to 62% of the screen.
 */
const BEAR_WIDTH_FRACTION = 0.62;
const BEAR_CENTRE_Y_FRACTION = 0.5;

async function main() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('This script needs sharp:\n\n  npm i --no-save sharp\n');
    process.exit(1);
  }

  for (const path of [BACKGROUND, BEAR]) {
    if (!fs.existsSync(path)) {
      console.error(`Missing ${path}`);
      process.exit(1);
    }
  }

  const background = sharp(BACKGROUND);
  const { width, height } = await background.metadata();
  if (!width || !height) {
    console.error('Could not read background dimensions');
    process.exit(1);
  }

  const bearWidth = Math.round(width * BEAR_WIDTH_FRACTION);
  const bear = await sharp(BEAR).resize({ width: bearWidth }).png().toBuffer();
  const bearHeight = (await sharp(bear).metadata()).height ?? bearWidth;

  const left = Math.round((width - bearWidth) / 2);
  const top = Math.round(height * BEAR_CENTRE_Y_FRACTION - bearHeight / 2);

  await background
    .composite([{ input: bear, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(OUT);

  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`wrote ${OUT} — ${width}x${height}, ${kb} KB`);
  console.log(`bear ${bearWidth}px wide at (${left}, ${top})`);
}

main();
