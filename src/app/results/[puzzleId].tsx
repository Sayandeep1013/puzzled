import { useLocalSearchParams } from 'expo-router';

import { ResultsScreen } from '@/features/results/results-screen';

export default function ResultsRoute() {
  const { puzzleId, size, time, coins } = useLocalSearchParams<{
    puzzleId: string;
    size?: string;
    time?: string;
    coins?: string;
  }>();

  return (
    <ResultsScreen
      puzzleId={puzzleId ?? 'unknown'}
      size={Number(size) || 6}
      time={Number(time) || 0}
      coins={Number(coins) || 0}
    />
  );
}
