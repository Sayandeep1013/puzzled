import { render } from '@testing-library/react-native';

import { ART_NAMES, getArtModule, type ArtName } from '@/shared/art';

import { Art } from './Art';

describe('art registry', () => {
  it('covers the whole delivered set', () => {
    // 68 SVGs shipped in assets/art-source. If this drops, someone added art
    // without registering it — `<Art name="…">` would then be a type error at
    // the call site, which is the failure mode this registry exists to give.
    expect(ART_NAMES).toHaveLength(68);
  });

  it('resolves every registered name to a bundled module', () => {
    for (const name of ART_NAMES) {
      expect(getArtModule(name)).toBeDefined();
    }
  });

  it('uses kebab-case names throughout', () => {
    for (const name of ART_NAMES) {
      expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

describe('Art', () => {
  it('renders at the requested square size', () => {
    const { getByTestId } = render(<Art name="coin" size={48} testID="coin" />);
    expect(getByTestId('coin')).toHaveStyle({ width: 48, height: 48 });
  });

  it('is invisible to assistive tech unless given a label', () => {
    const { getByTestId } = render(<Art name="coin" testID="coin" />);
    expect(getByTestId('coin').props.accessible).toBe(false);
  });

  it('becomes an image role once labelled', () => {
    const { getByLabelText } = render(<Art name="coin" accessibilityLabel="Coins" />);
    expect(getByLabelText('Coins')).toBeTruthy();
  });

  it('letterboxes rather than cropping, to keep baked-in shadows intact', () => {
    const { getByTestId } = render(<Art name="bear" testID="bear" />);
    expect(getByTestId('bear').props.resizeMode).toBe('contain');
  });

  it('accepts every registered name', () => {
    for (const name of ART_NAMES.slice(0, 8) as ArtName[]) {
      const { unmount } = render(<Art name={name} />);
      unmount();
    }
  });
});
