import { useLocalSearchParams } from 'expo-router';

import { PackScreen } from '@/features/pack/pack-screen';

export default function PackRoute() {
  const { packId } = useLocalSearchParams<{ packId: string }>();
  return <PackScreen packId={packId ?? 'unknown'} />;
}
