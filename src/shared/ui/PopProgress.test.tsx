import { render } from '@testing-library/react-native';

import { PopProgress } from './PopProgress';

describe('PopProgress', () => {
  it('reports fractional progress to assistive technology', () => {
    const { getByRole } = render(<PopProgress value={3} goal={4} />);
    expect(getByRole('progressbar').props.accessibilityValue).toEqual({
      min: 0,
      max: 4,
      now: 3,
    });
  });

  it('clamps a value above the goal', () => {
    const { getByTestId } = render(<PopProgress value={9} goal={4} testID="bar" />);
    expect(getByTestId('bar-fill')).toHaveStyle({ width: '100%' });
  });

  it('does not divide by zero when the goal is zero', () => {
    const { getByTestId } = render(<PopProgress value={0} goal={0} testID="bar" />);
    expect(getByTestId('bar-fill')).toHaveStyle({ width: '0%' });
  });
});
