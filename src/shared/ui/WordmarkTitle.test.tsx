import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { LETTER_COLORS, WordmarkTitle } from './WordmarkTitle';

describe('WordmarkTitle', () => {
  it('spells the name of the app', () => {
    // It used to read "PUZZLE JOURNEY", which is not what the app is called —
    // the launcher icon, the window title and the store listing all say Puzzled.
    const { getAllByText } = render(<WordmarkTitle />);
    // Each letter is drawn twice — a white outline copy behind, the coloured one
    // in front — so PUZZLED's two Zs yield four nodes and its single D yields two.
    expect(getAllByText('Z')).toHaveLength(4);
    expect(getAllByText('D')).toHaveLength(2);
    expect(getAllByText('P')).toHaveLength(2);
  });

  it('has a colour for every letter', () => {
    // PUZZLED is seven letters; the list was six long when the word was PUZZLE,
    // and a seventh letter would have taken `undefined` as its colour.
    expect(LETTER_COLORS).toHaveLength(7);
    expect(new Set(LETTER_COLORS).size).toBe(7);
  });

  it('draws a white outline copy behind each coloured letter', () => {
    // Without this second layer the logo reads as plain text: React Native has no
    // text stroke, and one thin shadow is not enough to look like an outline.
    const { getAllByText } = render(<WordmarkTitle />);
    const [outline, coloured] = getAllByText('P');
    expect(outline).toHaveStyle({ color: '#FFFFFF' });
    expect(coloured).toHaveStyle({ color: LETTER_COLORS[0] });
  });

  it('colours letters from the logo sequence, not the palette ramp order', () => {
    const { getAllByText } = render(<WordmarkTitle />);
    const [, p] = getAllByText('P');
    const [, u] = getAllByText('U');
    expect(p).toHaveStyle({ color: LETTER_COLORS[0] });
    expect(u).toHaveStyle({ color: LETTER_COLORS[1] });
  });

  it('never scales with the reader font setting', () => {
    // A logo is art. Seven letters at a 2x font scale run off a phone's width,
    // and branding that changes size with the system text setting is not
    // branding — this is the one place in the app that opts out.
    const { getAllByText } = render(<WordmarkTitle />);
    for (const node of getAllByText('P')) {
      expect(node.props.allowFontScaling).toBe(false);
    }
  });

  it('arches the word: outer letters tilt outward and drop below the middle', () => {
    const { getByTestId } = render(<WordmarkTitle />);

    const transformOf = (index: number) => {
      const flat = StyleSheet.flatten(getByTestId(`wordmark-letter-${index}`).props.style);
      return flat.transform as [{ translateY: number }, { rotateZ: string }];
    };

    // PUZZLED is seven letters, so 0 and 6 are the ends and 3 is the middle.
    const [firstDrop, firstTilt] = transformOf(0);
    const [lastDrop, lastTilt] = transformOf(6);
    const [midDrop] = transformOf(3);

    expect(firstTilt.rotateZ).toBe('-13deg');
    expect(lastTilt.rotateZ).toBe('13deg');
    // Symmetric ends, both sitting lower than the middle — that is the arch.
    expect(firstDrop.translateY).toBeCloseTo(lastDrop.translateY);
    expect(firstDrop.translateY).toBeGreaterThan(midDrop.translateY);
    // The centre letter sits on the baseline the arch is measured from.
    expect(midDrop.translateY).toBeCloseTo(0);
  });

  it('scales the whole word from one prop', () => {
    const { getAllByText } = render(<WordmarkTitle scale={2} />);
    const [, p] = getAllByText('P');
    expect(p).toHaveStyle({ fontSize: 124 });
  });

  it('exposes the whole logo as a single header to assistive tech', () => {
    // Seven separately-coloured letters, each drawn twice, must not be announced
    // one node at a time.
    const { getByLabelText } = render(<WordmarkTitle />);
    expect(getByLabelText('Puzzled')).toBeTruthy();
  });
});
