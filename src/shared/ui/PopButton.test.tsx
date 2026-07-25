import { fireEvent, render } from '@testing-library/react-native';
import { View as mockView } from 'react-native';

import { PopButton } from './PopButton';

// The library's own `react-native-reanimated/mock` re-imports the real
// `./index`, which (in the v4 split into react-native-worklets) unconditionally
// requires the native worklets loader and crashes under jest-expo's Node
// environment — the shipped mock is itself broken for this version. The real
// fix upstream is a jest `resolver` pointing at
// `react-native-worklets/jest/resolver.js` in the global jest config, but that
// changes test behaviour project-wide. Scope the fix to this file instead: a
// tiny self-contained mock covering exactly the API PopButton uses. (The
// `mock` name prefix is required — Jest's module-factory hoisting only
// permits closing over identifiers named `mock*`.)
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: mockView },
  useSharedValue: (initial: number) => ({ value: initial }),
  useAnimatedStyle: (factory: () => Record<string, unknown>) => factory(),
  withSpring: (toValue: number) => toValue,
}));

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
