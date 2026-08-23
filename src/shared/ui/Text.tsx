import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

/**
 * The app's `Text`. Every screen imports this instead of React Native's, because
 * React Native's default — `allowFontScaling` on, with no ceiling — is what cut
 * the ends off labels on other people's phones.
 *
 * Android's *Display size* and *Font size* settings multiply every `fontSize` by
 * up to 2x. Nothing else in this app scales with them: padding, row heights, tile
 * widths and the tab bar are all fixed points. So on a device with either setting
 * raised, a label outgrows the box drawn for it — and because almost every label
 * in this app sits inside a `PopSurface`, whose face is `overflow: 'hidden'`, the
 * overflow is not merely ugly, it is *deleted*. "Play" rendered as "Pla" with
 * nothing to indicate why. It never reproduced on a device left at the default
 * scale, which is exactly why it reached other people first.
 *
 * Two things fix that together, and neither is sufficient alone:
 *
 * 1. **This ceiling**, which bounds how far type can grow.
 * 2. **`numberOfLines` + `flexShrink` on the label primitives** (`PopButton`,
 *    `PopChip`, `PopTabBar`, the row titles), so a label that still does not fit
 *    — a long puzzle title, a narrow phone — narrows and ellipsises instead of
 *    overflowing into a clip.
 *
 * `Text.defaultProps` would have been the one-line version of this, and it is
 * why the wrapper exists instead: React 19 removed `defaultProps` for function
 * components, and RN 0.86's `Text` is one, so assigning it does nothing at all —
 * silently. A component is the only thing that still works.
 */

/**
 * Ceiling on the OS font scale, as a multiplier of the designed `fontSize`.
 *
 * Not 1.0: refusing to scale at all is a real accessibility regression, and this
 * app's type is small enough (11pt labels) that a reader who has asked for larger
 * text has asked for a reason. 1.25 is the most the fixed-height chrome absorbs —
 * measured against the tightest boxes in the app, the 42pt round buttons and the
 * tab bar's `LABEL_LINE` of 14 — while still giving a visible increase.
 */
export const MAX_FONT_SCALE = 1.25;

export type TextProps = RNTextProps;

export function Text({ maxFontSizeMultiplier = MAX_FONT_SCALE, ...rest }: TextProps) {
  return <RNText maxFontSizeMultiplier={maxFontSizeMultiplier} {...rest} />;
}
