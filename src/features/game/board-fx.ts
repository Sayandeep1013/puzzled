import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Tactile + timing helpers for the puzzle board, kept in one place so the render
 * code stays focused on drawing. Haptics are best-effort and never throw — a
 * device without a taptic engine (or web) simply gets no feedback.
 */

const HAPTICS_ENABLED = Platform.OS === 'ios' || Platform.OS === 'android';

/** A short impact — `light` when a piece is picked up, `medium` when it snaps home. */
export function impact(kind: 'light' | 'medium'): void {
  if (!HAPTICS_ENABLED) {
    return;
  }
  const style =
    kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
  // Fire-and-forget; a rejected promise (unsupported device) must not surface.
  void Haptics.impactAsync(style).catch(() => {});
}

/** The success buzz played once when the final piece locks. */
export function success(): void {
  if (!HAPTICS_ENABLED) {
    return;
  }
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Shared animation tuning so the board and its effects stay in sync. */
export const FX = {
  /** Rendered scale while a piece is lifted under the finger. */
  liftScale: 1.08,
  /** Peak scale of the snap "pop" before settling to 1. */
  popScale: 1.12,
  /** Spring settle time for a snapped piece, ms (visual only). */
  snapMs: 180,
  /** Multiplier on snapThreshold within which the ghost target + magnet appear. */
  magnetRatio: 1.6,
  /** How far (0..1) the rendered piece is pulled toward the slot at the magnet edge. */
  magnetPull: 0.35,
  /** Beat before handing off to the results screen so the celebration is seen, ms. */
  celebrateMs: 1200,
  /** Confetti particle count cap. */
  confettiCount: 80,
} as const;
