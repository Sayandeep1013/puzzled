import { useLocalSearchParams } from 'expo-router';

import { GameScreen } from '@/features/game/game-screen';

export default function GameRoute() {
  const { puzzleId } = useLocalSearchParams<{ puzzleId: string }>();

  return <GameScreen puzzleId={puzzleId ?? 'unknown'} />;
}
