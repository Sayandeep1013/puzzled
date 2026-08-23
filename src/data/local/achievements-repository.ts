import type { PuzzleCompletion } from '../repositories';

import { latestPerBoard } from './completions-repository';

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
  tone: 'grass' | 'berry' | 'blossom' | 'honey';
}

export interface AchievementState extends AchievementDefinition {
  current: number;
  unlocked: boolean;
}

interface Measured extends AchievementDefinition {
  /**
   * `boards` is one entry per distinct (puzzle, size) — what "complete N
   * puzzles" means. `attempts` is every completion including replays, for goals
   * about a single performance rather than a count.
   */
  measure: (boards: readonly PuzzleCompletion[], attempts: readonly PuzzleCompletion[]) => number;
}

const DEFINITIONS: readonly Measured[] = [
  {
    key: 'first-puzzle',
    title: 'First Puzzle',
    description: 'Complete your first puzzle',
    goal: 1,
    icon: 'check',
    tone: 'grass',
    measure: (boards) => boards.length,
  },
  {
    key: 'collector',
    title: 'Puzzle Collector',
    description: 'Complete 50 puzzles',
    goal: 50,
    icon: 'puzzle',
    tone: 'berry',
    // Distinct boards. "Complete 50 puzzles" should not be satisfiable by
    // finishing the same puzzle fifty times.
    measure: (boards) => boards.length,
  },
  {
    key: 'hard-worker',
    title: 'Hard Worker',
    description: 'Complete 10 boards of 8×8 or larger',
    goal: 10,
    icon: 'medal',
    tone: 'blossom',
    measure: (boards) => boards.filter((entry) => entry.gridSize >= 8).length,
  },
  {
    key: 'speed-master',
    title: 'Speed Master',
    description: 'Finish a puzzle in under 10 minutes',
    goal: 1,
    icon: 'sparkle',
    tone: 'honey',
    // Every attempt, not distinct boards: this is about one fast solve, and a
    // replay that finally beats ten minutes should count.
    measure: (_boards, attempts) => attempts.filter((e) => e.elapsedMs < 10 * 60 * 1000).length,
  },
] as const;

export const ACHIEVEMENTS: readonly AchievementDefinition[] = DEFINITIONS;

/**
 * Pure: computes progress from the completions log.
 *
 * It used to take progress summaries and filter for `status === 'completed'` —
 * the *current* state of the one session row per board. Replaying a finished
 * puzzle overwrites that row, so every achievement earned on it silently
 * re-locked. Progress you have made cannot be undone by playing more, so this
 * reads the append-only record instead.
 *
 * Every `current` is clamped to its `goal`, and results come back
 * one-per-definition in `ACHIEVEMENTS` order.
 */
export function deriveAchievements(completions: readonly PuzzleCompletion[]): AchievementState[] {
  const boards = latestPerBoard(completions);
  return DEFINITIONS.map(({ measure, ...definition }) => {
    const current = Math.min(measure(boards, completions), definition.goal);
    return { ...definition, current, unlocked: current >= definition.goal };
  });
}
