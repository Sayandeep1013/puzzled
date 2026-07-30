import { render } from '@testing-library/react-native';

import { accentAt } from '@/shared/theme';

import { WordmarkTitle } from './WordmarkTitle';

describe('WordmarkTitle', () => {
  it('renders every letter of PUZZLE separately, so each can take its own colour', () => {
    const { getAllByText } = render(<WordmarkTitle />);
    // Two Zs and two other distinct letters; asserting the doubled letter proves
    // letters are individual nodes rather than one string.
    expect(getAllByText('Z')).toHaveLength(2);
    expect(getAllByText('P')).toHaveLength(1);
    expect(getAllByText('E')).toHaveLength(1);
  });

  it('colours letters from the accent ramp in order', () => {
    const { getAllByText } = render(<WordmarkTitle />);
    const [p] = getAllByText('P');
    const [u] = getAllByText('U');
    expect(p).toHaveStyle({ color: accentAt(0) });
    expect(u).toHaveStyle({ color: accentAt(1) });
  });

  it('renders JOURNEY as one badge word', () => {
    const { getByText } = render(<WordmarkTitle />);
    expect(getByText('JOURNEY')).toBeTruthy();
  });

  it('exposes the whole logo as a single header to assistive tech', () => {
    // Six separately-coloured letters must not be announced one at a time.
    const { getByLabelText } = render(<WordmarkTitle />);
    expect(getByLabelText('Puzzle Journey')).toBeTruthy();
  });

  it('scales both words from one prop', () => {
    const { getAllByText } = render(<WordmarkTitle scale={2} />);
    const [p] = getAllByText('P');
    expect(p).toHaveStyle({ fontSize: 92 });
  });
});
