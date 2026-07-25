import { fireEvent, render } from '@testing-library/react-native';

import { PopButton } from './PopButton';

describe('PopButton', () => {
  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<PopButton label="Play" onPress={onPress} />);
    fireEvent.press(getByText('Play'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<PopButton label="Play" onPress={onPress} disabled />);
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes the label as the default accessibility label', () => {
    const { getByLabelText } = render(<PopButton label="Play" />);
    expect(getByLabelText('Play')).toBeTruthy();
  });

  it('prefers an explicit accessibility label over the visible one', () => {
    const { getByLabelText } = render(
      <PopButton label="3" accessibilityLabel="Three hints remaining" />,
    );
    expect(getByLabelText('Three hints remaining')).toBeTruthy();
  });

  it('marks itself disabled for assistive technology', () => {
    const { getByRole } = render(<PopButton label="Play" disabled />);
    expect(getByRole('button')).toBeDisabled();
  });
});
