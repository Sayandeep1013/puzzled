/**
 * Rasterizes the Puzzle Journey art set into the PNG densities the app ships.
 *
 * The team authors flat-colour SVGs. We do NOT render those at runtime:
 * measured on this set, `react-native-svg` would carry 5.1 MB of path data
 * (one chest alone is 1.1 MB after optimisation) and rebuild native paths on
 * every mount. The same 68 assets as PNG @1x/2x/3x total ~1.5 MB and cost
 * nothing to mount. Multicolour illustrations never need runtime tinting, so
 * vector buys us nothing here.
 *
 * Generated PNGs are committed, so a normal install and a normal EAS build
 * never run this script and never need `sharp`. Run it only when the art
 * changes:
 *
 *   npm i --no-save sharp svgo
 *   node scripts/build-art.mjs
 *
 * Source of truth is `assets/art-source/*.svg`. Output is
 * `assets/art/<name>.png`, `<name>@2x.png`, `<name>@3x.png`, which is the
 * naming convention Metro's asset resolver expects — `require` the @1x path
 * and the correct density is picked per device.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const SRC = 'assets/art-source';
const OUT = 'assets/art';

/**
 * Source box per asset, in logical points, matching the largest on-screen size
 * the asset is drawn at. @3x is 3x this in pixels.
 *
 * Sizing this per asset is a memory decision, not a disk one: a decoded PNG
 * costs width x height x 4 bytes in RAM regardless of its file size, so
 * rendering every icon at hero resolution would waste tens of MB on screens
 * that show twenty of them at once.
 */
const ICON_BOX = 64;
const MEDIUM_BOX = 128;
const HERO_BOX = 224;

/** Mascots and full-scene art, drawn 180pt+. */
const HERO = new Set([
  'bear',
  'bear-excited',
  'happy-duck',
  'winking-duck',
  'change-avatar',
]);

/** Shop bundles, achievement badges, category art — drawn 80–128pt. */
const MEDIUM = new Set([
  'castle',
  'car',
  'mountain',
  'puppy',
  'chest',
  'chest-open',
  'gold-chest',
  'gems-chest',
  'coin-chest-2200',
  'coin-chest-5000',
  'coin-chest-10000',
  'coins-500',
  'coins-1200',
  'coins-1500',
  'reward',
  'reward-alt',
  'sticker-book',
  'collection',
  'preview-image',
  'my-trophies',
  'shield-star',
  'cup',
  'cup-star',
  'badge-1st',
  'badge-2nd',
  'badge-3rd',
  'watch-ad',
]);

function boxFor(name) {
  if (HERO.has(name)) return HERO_BOX;
  if (MEDIUM.has(name)) return MEDIUM_BOX;
  return ICON_BOX;
}

const DENSITIES = [
  { suffix: '', scale: 1 },
  { suffix: '@2x', scale: 2 },
  { suffix: '@3x', scale: 3 },
];

const SVGO_CONFIG = {
  multipass: true,
  // Precision 1 is visually lossless on this set and cuts it by ~78%.
  // Precision 0 shreds the dense chest artwork — do not lower this.
  floatPrecision: 1,
  plugins: [
    'preset-default',
    { name: 'convertPathData', params: { floatPrecision: 1, transformPrecision: 1 } },
    'removeDimensions',
  ],
};

async function main() {
  let sharp;
  let optimize;
  try {
    sharp = (await import('sharp')).default;
    optimize = (await import('svgo')).optimize;
  } catch {
    console.error(
      'This script needs sharp and svgo, which are intentionally not project\n' +
        'dependencies (the generated PNGs are committed). Install them ad hoc:\n\n' +
        '  npm i --no-save sharp svgo\n'
    );
    process.exit(1);
  }

  if (!fs.existsSync(SRC)) {
    console.error(`Missing source directory: ${SRC}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });

  const files = fs
    .readdirSync(SRC)
    .filter((f) => f.toLowerCase().endsWith('.svg'))
    .sort();

  if (files.length === 0) {
    console.error(`No SVGs found in ${SRC}`);
    process.exit(1);
  }

  let written = 0;
  let bytes = 0;
  const names = [];

  for (const file of files) {
    const name = path.basename(file, '.svg');
    names.push(name);
    const box = boxFor(name);
    const raw = fs.readFileSync(path.join(SRC, file), 'utf8');

    let svg = raw;
    try {
      svg = optimize(raw, { ...SVGO_CONFIG, path: path.join(SRC, file) }).data;
    } catch (error) {
      console.warn(`  svgo skipped ${file}: ${error.message}`);
    }

    for (const density of DENSITIES) {
      const px = box * density.scale;
      const target = path.join(OUT, `${name}${density.suffix}.png`);
      // density: 300 renders the vector at high resolution before the fit,
      // so downscaling never softens edges.
      const png = await sharp(Buffer.from(svg), { density: 300 })
        .resize(px, px, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9, palette: true })
        .toBuffer();
      fs.writeFileSync(target, png);
      written += 1;
      bytes += png.length;
    }
    process.stdout.write('.');
  }

  console.log(
    `\n${files.length} assets -> ${written} PNGs, ${(bytes / 1024 / 1024).toFixed(2)} MB total`
  );
  console.log(`\nIf you added or renamed an asset, update the registry in src/shared/art.ts.`);
}

main();
