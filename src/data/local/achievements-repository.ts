import type { PuzzleProgressSummary } from '../repositories';

/**
 * Data-layer description of an achievement. `icon` is a plain string and
 * `tone` a semantic token name — never a hex value or a `PopIconName` — so
 * this file stays free of any `src/shared/ui` or palette import. The
 * achievements screen maps `tone` to a colour and casts `icon` to
 * `PopIconName` at the render boundary.
 */
export interface AchievementDefinition {
  key: string;
  title: string;
  description: string;
  goal: number;
  icon: string;
  tone: 'mint' | 'grape' | 'bubblegum' | 'sunshine';
}

export interface AchievementState extends AchievementDefinition {
  current: number;
  unlocked: boolean;
}

interface Measured extends AchievementDefinition {
  measure: (completed: readonly PuzzleProgressSummary[]) => number;
}

const DEFINITIONS: readonly Measured[] = [
  {
    key: 'first-puzzle',
    title: 'First Puzzle',
    description: 'Complete your first puzzle',
    goal: 1,
    icon: 'check',
    tone: 'mint',
    measure: (completed) => completed.length,
  },
  {
    key: 'collector',
    title: 'Puzzle Collector',
    description: 'Complete 50 puzzles',
    goal: 50,
    icon: 'puzzle',
    tone: 'grape',
    measure: (completed) => completed.length,
  },
  {
    key: 'hard-worker',
    title: 'Hard Worker',
    description: 'Complete 10 boards of 8×8 or larger',
    goal: 10,
    icon: 'medal',
    tone: 'bubblegum',
    measure: (completed) => completed.filter((s) => s.gridSize >= 8).length,
  },
  {
    key: 'speed-master',
    title: 'Speed Master',
    description: 'Finish a puzzle in under 10 minutes',
    goal: 1,
    icon: 'sparkle',
    tone: 'sunshine',
    measure: (completed) => completed.filter((s) => s.elapsedMs < 10 * 60 * 1000).length,
  },
] as const;

export const ACHIEVEMENTS: readonly AchievementDefinition[] = DEFINITIONS;

/**
 * Pure: computes progress from completed puzzles only. In-progress sessions
 * never count. Every `current` is clamped to its `goal`, and results come
 * back one-per-definition in `ACHIEVEMENTS` order.
 */
export function deriveAchievements(
  summaries: readonly PuzzleProgressSummary[],
): AchievementState[] {
  const completed = summaries.filter((s) => s.status === 'completed');
  return DEFINITIONS.map(({ measure, ...definition }) => {
    const current = Math.min(measure(completed), definition.goal);
    return { ...definition, current, unlocked: current >= definition.goal };
  });
}
