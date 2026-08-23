// Node globals are referenced here rather than added to tsconfig's `types`, so
// `fs`/`__dirname` stay out of scope for the app code, which has no filesystem.
/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { render } from '@testing-library/react-native';

import { MAX_FONT_SCALE, Text } from './Text';

/**
 * Guards the fix for labels losing their ends on other people's phones.
 *
 * Android's *Display size* and *Font size* settings multiply every `fontSize`,
 * while this app's padding, row heights and tab bar are fixed points — so a
 * raised scale pushes labels out of boxes that clip (`PopSurface`'s face is
 * `overflow: 'hidden'`) and the overflow is deleted rather than wrapped. "Play"
 * rendered as "Pla".
 *
 * It never reproduces at the default scale, which is why it shipped: nothing in
 * a normal review or on a developer's own device shows it. So the contract is
 * pinned here instead — both halves of it.
 */

const SRC = path.join(__dirname, '../..');

/** Every `.ts`/`.tsx` under `src/`, excluding tests and this file. */
function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(full, found);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

/**
 * `Text` imported as a bare specifier from `react-native`. Deliberately narrow:
 * `type TextProps` and `Text as RNText` are both fine, and the wrapper itself
 * needs the latter.
 */
function importsRawText(source: string): boolean {
  const statement = source.match(/import\s*\{([\s\S]*?)\}\s*from\s*'react-native';/);
  if (!statement) {
    return false;
  }
  return statement[1]
    .split(',')
    .map((specifier) => specifier.trim())
    .includes('Text');
}

describe('shared Text', () => {
  it('caps the OS font scale by default', () => {
    const { getByText } = render(<Text>Play</Text>);
    expect(getByText('Play').props.maxFontSizeMultiplier).toBe(MAX_FONT_SCALE);
  });

  it('lets a caller opt out for a specific label', () => {
    const { getByText } = render(<Text maxFontSizeMultiplier={2}>Play</Text>);
    expect(getByText('Play').props.maxFontSizeMultiplier).toBe(2);
  });

  it('scales, rather than refusing to scale', () => {
    // 1.0 would be a real accessibility regression — a reader who raised their
    // font size asked for a reason, and this app's labels go down to 11pt.
    expect(MAX_FONT_SCALE).toBeGreaterThan(1);
    // And it must stay inside what the fixed-height chrome absorbs: the 42pt
    // round buttons and the tab bar's 14pt `LABEL_LINE`.
    expect(MAX_FONT_SCALE).toBeLessThanOrEqual(1.3);
  });

  it('is the only Text the app renders', () => {
    // React Native's `Text` scales without a ceiling. One raw import is enough
    // to put an uncapped label back on a clipping surface, so none are allowed.
    const offenders = sourceFiles(SRC)
      .filter((file) => file !== path.join(__dirname, 'Text.tsx'))
      .filter((file) => importsRawText(readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC, file).split(path.sep).join('/'));

    expect(offenders).toEqual([]);
  });
});
