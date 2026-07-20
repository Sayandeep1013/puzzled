import { useLocalSearchParams } from 'expo-router';

import { GameScreen, isPlayableGridSize } from '@/features/game/game-screen';

export default function GameRoute() {
  const { puzzleId, size } = useLocalSearchParams<{ puzzleId: string; size?: string }>();

  const requested = Number(size);
  const initialGridSize = isPlayableGridSize(requested) ? requested : undefined;

  return <GameScreen puzzleId={puzzleId ?? 'unknown'} initialGridSize={initialGridSize} />;
}
