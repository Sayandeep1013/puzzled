import { Trophy } from 'phosphor-react-native';
import { render } from '@testing-library/react-native';

import { colors } from '@/shared/theme';

import { PopIcon } from './PopIcon';

describe('PopIcon', () => {
  it('renders a known icon', () => {
    const { getByTestId } = render(<PopIcon name="puzzle" testID="icon" />);
    expect(getByTestId('icon')).toBeTruthy();
  });

  // Adapted from the brief: phosphor-react-native's `IconBase` destructures
  // `weight` to pick which SVG path variant to draw and never spreads it back
  // onto the rendered node, so `icon.props.weight` is always `undefined` —
  // asserting `.toBe('fill')` on it would be asserting a prop that can never
  // exist, i.e. a test that can never fail. `color` genuinely is forwarded
  // (IconBase sets it explicitly on the `Svg`), so that half of the brief's
  // test is kept as-is. For weight, we instead render the same icon directly
  // from phosphor-react-native with an explicit `weight="fill"` and diff the
  // full output tree against PopIcon's default — this fails the moment
  // PopIcon's default weight stops being "fill" (e.g. someone changes it to
  // "regular"), which is the behaviour we actually care about.
  it('defaults to ink and the fill weight so icons read as chunky', () => {
    const actual = render(<PopIcon name="trophy" testID="icon" />);
    expect(actual.getByTestId('icon').props.color).toBe(colors.ink);

    const expected = render(<Trophy weight="fill" color={colors.ink} testID="icon" />);
    expect(actual.toJSON()).toEqual(expected.toJSON());
  });
});
