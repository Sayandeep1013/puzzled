import { render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { colors, radii, shadow } from '@/shared/theme';

import { PopSurface } from './PopSurface';

describe('PopSurface', () => {
  it('renders its children', () => {
    const { getByText } = render(
      <PopSurface>
        <Text>hello</Text>
      </PopSurface>,
    );
    expect(getByText('hello')).toBeTruthy();
  });

  it('applies the requested fill and radius', () => {
    const { getByTestId } = render(
      <PopSurface testID="surface" fill={colors.grass} radius={radii.lg} />,
    );
    expect(getByTestId('surface')).toHaveStyle({
      backgroundColor: colors.grass,
      borderRadius: radii.lg,
    });
  });

  it('wears a blurred shadow rather than a hard offset one', () => {
    const { getByTestId } = render(<PopSurface testID="surface" elevation="raised" />);
    const flat = StyleSheet.flatten(getByTestId('surface').props.style);
    expect(flat.boxShadow).toBe(shadow.raised);
    // The Chunky Pop mechanic is gone: no sibling shadow view, and no reserved
    // layout space for one. If either returns, this direction has regressed.
    expect(flat).not.toHaveProperty('paddingRight');
    expect(flat).not.toHaveProperty('elevation');
  });

  it('has no outline — this theme draws no borders', () => {
    const { getByTestId } = render(<PopSurface testID="surface" />);
    const wrapper = StyleSheet.flatten(getByTestId('surface').props.style);
    const face = StyleSheet.flatten(getByTestId('surface-face').props.style);
    for (const style of [wrapper, face]) {
      expect(style).not.toHaveProperty('borderWidth');
      expect(style).not.toHaveProperty('borderColor');
    }
  });

  it('omits the shadow entirely when nested', () => {
    const { getByTestId } = render(<PopSurface testID="surface" elevation="none" />);
    const flat = StyleSheet.flatten(getByTestId('surface').props.style);
    expect(flat).not.toHaveProperty('boxShadow');
  });

  it('clips content to the radius so nested images follow the corner', () => {
    const { getByTestId } = render(<PopSurface testID="surface" radius={radii.md} />);
    expect(getByTestId('surface-face')).toHaveStyle({
      overflow: 'hidden',
      borderRadius: radii.md,
    });
  });
});
