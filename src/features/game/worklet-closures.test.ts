import { transformSync } from '@babel/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the one rule that has now crashed the app twice: **nothing a worklet closes
 * over may contain a Skia object.**
 *
 * A worklet's closure captures whole *variables*, not the properties it reads. Writing
 * `prepared.cx` inside a worklet puts `prepared` into the shareable, and a
 * `PreparedPiece` carries `skPath` and `overlay.image` — both JSI host objects. Worklets
 * does not reject those: `cloneHostObject` hands the raw reference across and rewraps
 * the *same* C++ instance on the UI runtime, so one Skia object ends up aliased by two
 * runtimes with nothing coordinating its lifetime.
 *
 * Both crashes were native and silent — no JS error, no red screen, just the process
 * dying — which is exactly what makes this worth a test rather than a code review note:
 *
 * - `SIGABRT`, `jsi.h: Value::getObject: assertion "isObject()" failed`, from
 *   `releasePiece` reading `preparedById` in a `runOnJS` closure.
 * - `SIGSEGV`, null dereference through `libworklets.so` → `libhermesvm.so`, with
 *   `FloatingPiece`'s `useDerivedValue` capturing `prepared` on every grab.
 *
 * Reading the closures the babel plugin actually emits is the only honest check. The
 * rule is invisible in the source — `prepared.cx` looks like it captures a number — so
 * a reviewer cannot see the violation, and neither can the type checker.
 */

/** Files whose worklets touch board geometry, and so are tempted by `PreparedPiece`. */
const WORKLET_SOURCES = ['puzzle-board.tsx', 'use-board-camera.ts'];

/**
 * Identifiers that carry a Skia object, directly or as a field.
 *
 * A denylist rather than an allowlist because the safe set is every number, shared
 * value and plain record in the file, and enumerating those would fail on every
 * unrelated edit. These are the names that actually hold host objects.
 */
const SKIA_BEARING = [
  'prepared',
  'preparedById',
  'cluster',
  'clusters',
  'clusterCache',
  'overlay',
  'skPath',
  'image',
  'draggingPrepared',
];

function closuresOf(filename: string): { source: string; captured: string[] }[] {
  const path = join(__dirname, filename);
  const output = transformSync(readFileSync(path, 'utf8'), {
    // The plugin reads the file back off disk to build the worklet string, so it must
    // be given the real path rather than a synthetic one.
    filename: path,
    configFile: false,
    babelrc: false,
    plugins: [
      ['@babel/plugin-syntax-typescript', { isTSX: filename.endsWith('.tsx') }],
      'react-native-worklets/plugin',
    ],
  });

  const code = output?.code ?? '';
  return [...code.matchAll(/_closure = \{([^}]*)\}/g)].map((match) => ({
    source: filename,
    captured: match[1]
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  }));
}

describe('worklet closures', () => {
  it.each(WORKLET_SOURCES)('%s captures no Skia-bearing object', (filename) => {
    const offenders = closuresOf(filename)
      .map(({ captured }) => captured.filter((name) => SKIA_BEARING.includes(name)))
      .filter((names) => names.length > 0)
      .flat();

    // Named in the failure so the fix is obvious: read the numbers out into their own
    // consts *outside* the worklet, as `FloatingPiece` and `releaseGeometry` both do.
    expect(offenders).toEqual([]);
  });

  it('reads real closures, so the guard cannot pass by finding nothing', () => {
    // Without this, deleting every worklet — or the matcher silently ceasing to match
    // the plugin's output format — would look like a pass.
    const all = WORKLET_SOURCES.flatMap(closuresOf);
    expect(all.length).toBeGreaterThan(15);
    expect(all.some(({ captured }) => captured.length > 0)).toBe(true);
  });
});
