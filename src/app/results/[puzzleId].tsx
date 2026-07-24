import { useLocalSearchParams } from 'expo-router';

import { ResultsScreen } from '@/features/results/results-screen';

export default function ResultsRoute() {
  const { puzzleId, size, time } = useLocalSearchParams<{
    puzzleId: string;
    size?: string;
    time?: string;
  }>();

  return (
    <ResultsScreen
      puzzleId={puzzleId ?? 'unknown'}
      size={Number(size) || 6}
      time={Number(time) || 0}
    />
  );
}
