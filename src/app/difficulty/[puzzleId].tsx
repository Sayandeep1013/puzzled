import { useLocalSearchParams } from 'expo-router';

import { DifficultyScreen } from '@/features/difficulty/difficulty-screen';

export default function DifficultyRoute() {
  const { puzzleId } = useLocalSearchParams<{ puzzleId: string }>();
  return <DifficultyScreen puzzleId={puzzleId ?? 'unknown'} />;
}
