import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getWalletRepository, type Wallet } from '@/data';
import { accentAt, colors, radii, spacing, typography } from '@/shared/theme';
import { PopButton, PopHeader, PopIcon, PopSurface } from '@/shared/ui';

interface HintBundle {
  key: string;
  hints: number;
  /** Cost in coins — the only currency this shop spends; there is no real-money IAP yet. */
  price: number;
}

/**
 * The shop's coin-priced offer table. Real-money coin packs and Remove Ads are
 * Phase 4 (IAP) and are intentionally not rendered here — a placeholder alert
 * button would just be a dishonest dead tap target, so they are hidden
 * instead until the real purchase flow ships.
 */
const HINT_BUNDLES: HintBundle[] = [
  { key: 'small', hints: 5, price: 100 },
  { key: 'medium', hints: 15, price: 250 },
  { key: 'large', hints: 30, price: 450 },
];

const EMPTY_WALLET: Wallet = { coins: 0, hints: 0 };

/** Text/icon colour that stays readable on each accent fill (mirrors `PopButton`'s contrast table). */
const ON_ACCENT = new Map<string, string>([
  [colors.grape, colors.onFill],
  [colors.bubblegum, colors.onFill],
  [colors.tangerine, colors.onFill],
  [colors.sunshine, colors.ink],
  [colors.mint, colors.ink],
  [colors.sky, colors.ink],
]);

/** Best-effort balance read. Returns `null` (never a fabricated zero) on failure. */
async function fetchWallet(): Promise<Wallet | null> {
  try {
    return await (await getWalletRepository()).balance();
  } catch {
    return null;
  }
}

export function ShopScreen() {
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet>(EMPTY_WALLET);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  // Refetch on focus so coins earned from a just-finished puzzle show up here.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchWallet().then((balance) => {
        if (active && balance) setWallet(balance);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const onBuy = useCallback(
    async (bundle: HintBundle) => {
      if (purchasing || wallet.coins < bundle.price) {
        return;
      }
      setPurchasing(bundle.key);
      try {
        const next = await (await getWalletRepository()).record({
          deltaCoins: -bundle.price,
          deltaHints: bundle.hints,
          reason: 'hint-purchase',
          ref: null,
        });
        setWallet(next);
      } catch {
        // Best-effort; a failed purchase leaves the last-known balance to retry.
        const balance = await fetchWallet();
        if (balance) setWallet(balance);
      } finally {
        setPurchasing(null);
      }
    },
    [purchasing, wallet.coins],
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <PopHeader
          title="Shop"
          onBack={() => router.back()}
          right={
            <View style={styles.balance}>
              <PopIcon name="coin" size={18} color={colors.sunshine} />
              <Text style={styles.balanceText}>{wallet.coins}</Text>
            </View>
          }
        />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Hint Bundles</Text>
            <Text style={styles.sectionMeta}>
              {wallet.hints} {wallet.hints === 1 ? 'hint' : 'hints'} on hand
            </Text>
          </View>

          {HINT_BUNDLES.map((bundle, index) => (
            <HintBundleRow
              key={bundle.key}
              bundle={bundle}
              fill={accentAt(index)}
              affordable={wallet.coins >= bundle.price}
              purchasing={purchasing === bundle.key}
              onBuy={() => onBuy(bundle)}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function HintBundleRow({
  bundle,
  fill,
  affordable,
  purchasing,
  onBuy,
}: {
  bundle: HintBundle;
  /** Deterministic per-position accent from `accentAt` — the colour frame around the row. */
  fill: string;
  affordable: boolean;
  purchasing: boolean;
  onBuy: () => void;
}) {
  const onTone = ON_ACCENT.get(fill) ?? colors.ink;
  const disabled = !affordable || purchasing;

  return (
    <PopSurface fill={fill} radius={radii.md} contentStyle={styles.rowFrame}>
      <View style={styles.rowBody}>
        <View style={[styles.badge, { backgroundColor: fill }]}>
          <PopIcon name="hint" size={26} color={onTone} />
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>{bundle.hints} hints</Text>
          <Text style={styles.rowMeta}>
            {affordable ? 'Spend one to reveal a piece' : 'Not enough coins yet'}
          </Text>
        </View>
        <PopButton
          label={purchasing ? 'Buying…' : `${bundle.price}`}
          icon={
            purchasing ? undefined : (
              <PopIcon name="coin" size={16} color={disabled ? colors.inkMuted : colors.ink} />
            )
          }
          tone="sunshine"
          size="sm"
          disabled={disabled}
          accessibilityLabel={`Buy ${bundle.hints} hints for ${bundle.price} coins`}
          onPress={onBuy}
        />
      </View>
    </PopSurface>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  safe: { flex: 1 },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  balanceText: { ...typography.bodyStrong, color: colors.ink },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: { ...typography.title, fontSize: 22, color: colors.ink },
  sectionMeta: { ...typography.caption, color: colors.inkMuted },
  // Inset padding on the coloured `PopSurface` face, so a ring of `fill` shows
  // as a frame around the white row body nested inside it (the `home-screen.tsx`
  // `PuzzleCard` pattern) — ink-on-saturated-fill body text fails contrast.
  rowFrame: { padding: spacing.xs },
  rowBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { ...typography.heading, fontSize: 18, color: colors.ink },
  rowMeta: { ...typography.caption, color: colors.inkMuted },
});
