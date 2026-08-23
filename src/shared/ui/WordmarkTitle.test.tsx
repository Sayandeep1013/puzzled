import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { WordmarkTitle } from './WordmarkTitle';

const styleOf = (node: { props: { style?: unknown } }) =>
  StyleSheet.flatten(node.props.style) as { width: number; height: number };

describe('WordmarkTitle', () => {
  it('exposes the whole logo as a single header to assistive tech', () => {
    // The lockup is one thing to a reader, whatever it is made of.
    const { getByLabelText } = render(<WordmarkTitle />);
    expect(getByLabelText('Puzzle Journey')).toBeTruthy();
  });

  it('scales width and height together, so the lockup is never stretched', () => {
    const { getByTestId } = render(<WordmarkTitle />);
    const { width, height } = styleOf(getByTestId('wordmark').children[0] as never);

    const doubled = render(<WordmarkTitle scale={2} />);
    const big = styleOf(doubled.getByTestId('wordmark').children[0] as never);

    expect(big.width).toBeCloseTo(width * 2);
    expect(big.height).toBeCloseTo(height * 2);
    expect(big.width / big.height).toBeCloseTo(width / height);
  });

  it('reserves height before the image decodes', () => {
    // Both dimensions are explicit rather than left to the intrinsic size, or
    // everything below the logo jumps down when the art finishes loading.
    const { getByTestId } = render(<WordmarkTitle />);
    const { width, height } = styleOf(getByTestId('wordmark').children[0] as never);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it('does not scale with the reader font setting', () => {
    // The regression this replaced: the lockup was seven `<Text>` nodes, so at a
    // 2x accessibility font scale it grew wider than the screen. An image cannot.
    const { queryAllByRole } = render(<WordmarkTitle />);
    expect(queryAllByRole('text')).toHaveLength(0);
  });
});
