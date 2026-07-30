import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { LETTER_COLORS, WordmarkTitle } from './WordmarkTitle';

describe('WordmarkTitle', () => {
  it('renders every letter separately so each can take its own colour and tilt', () => {
    const { getAllByText } = render(<WordmarkTitle />);
    // Each letter is drawn twice — a white outline copy behind, the coloured one
    // in front — so PUZZLE's two Zs yield four nodes and its single P yields two.
    expect(getAllByText('Z')).toHaveLength(4);
    expect(getAllByText('P')).toHaveLength(2);
    expect(getAllByText('E')).toHaveLength(2);
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

  it('arches the word: outer letters tilt outward and drop below the middle', () => {
    const { getByTestId } = render(<WordmarkTitle />);

    const transformOf = (index: number) => {
      const flat = StyleSheet.flatten(getByTestId(`wordmark-letter-${index}`).props.style);
      return flat.transform as [{ translateY: number }, { rotateZ: string }];
    };

    // PUZZLE is six letters, so 0 and 5 are the ends and 2/3 straddle the middle.
    const [firstDrop, firstTilt] = transformOf(0);
    const [lastDrop, lastTilt] = transformOf(5);
    const [midDrop] = transformOf(2);

    expect(firstTilt.rotateZ).toBe('-13deg');
    expect(lastTilt.rotateZ).toBe('13deg');
    // Symmetric ends, both sitting lower than the middle — that is the arch.
    expect(firstDrop.translateY).toBeCloseTo(lastDrop.translateY);
    expect(firstDrop.translateY).toBeGreaterThan(midDrop.translateY);
  });

  it('renders JOURNEY as one badge word', () => {
    const { getByText } = render(<WordmarkTitle />);
    expect(getByText('JOURNEY')).toBeTruthy();
  });

  it('exposes the whole logo as a single header to assistive tech', () => {
    // Six separately-coloured letters, each drawn twice, must not be announced
    // one node at a time.
    const { getByLabelText } = render(<WordmarkTitle />);
    expect(getByLabelText('Puzzle Journey')).toBeTruthy();
  });

  it('scales both words from one prop', () => {
    const { getAllByText, getByText } = render(<WordmarkTitle scale={2} />);
    const [, p] = getAllByText('P');
    expect(p).toHaveStyle({ fontSize: 124 });
    expect(getByText('JOURNEY')).toHaveStyle({ fontSize: 54 });
  });

  it('separates PUZZLE and JOURNEY instead of overlapping them', () => {
    // The badge used to carry a negative top margin, which pulled the two words
    // together and made the logo look cramped.
    const { getByTestId } = render(<WordmarkTitle />);
    const badge = StyleSheet.flatten(getByTestId('wordmark-badge').props.style);
    expect(badge.marginTop).toBeGreaterThan(0);
  });
});
