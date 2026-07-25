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

  it('reserves layout space for the offset shadow', () => {
    const { getByTestId } = render(<PopSurface testID="surface" offset={shadow.hero} />);
    expect(getByTestId('surface')).toHaveStyle({
      paddingRight: shadow.hero,
      paddingBottom: shadow.hero,
    });
  });

  it('draws the shadow in ink with no blur radius', () => {
    const { getByTestId } = render(<PopSurface testID="surface" />);
    const shade = getByTestId('surface-shadow');
    expect(shade).toHaveStyle({ backgroundColor: colors.ink });
    const flat = StyleSheet.flatten(shade.props.style);
    expect(flat).not.toHaveProperty('shadowRadius');
    expect(flat).not.toHaveProperty('elevation');
  });

  it('applies the requested fill and radius to the face', () => {
    const { getByTestId } = render(
      <PopSurface testID="surface" fill={colors.mint} radius={radii.lg} />,
    );
    expect(getByTestId('surface-face')).toHaveStyle({
      backgroundColor: colors.mint,
      borderRadius: radii.lg,
      borderColor: colors.ink,
    });
  });
});
