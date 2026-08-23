import { useLocalSearchParams } from 'expo-router';

import { ResultsScreen } from '@/features/results/results-screen';

export default function ResultsRoute() {
  const { puzzleId, size, timeMs, coins } = useLocalSearchParams<{
    puzzleId: string;
    size?: string;
    /** Milliseconds, matching `session.elapsedMs` — not seconds. */
    timeMs?: string;
    coins?: string;
  }>();

  return (
    <ResultsScreen
      puzzleId={puzzleId ?? 'unknown'}
      size={Number(size) || 6}
      timeMs={Number(timeMs) || 0}
      coins={Number(coins) || 0}
    />
  );
}
