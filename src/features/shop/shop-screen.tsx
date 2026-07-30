import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getWalletRepository, type Wallet } from '@/data';
import { type ArtName } from '@/shared/art';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { Art, PopButton, PopHeader, PopSurface } from '@/shared/ui';

interface HintBundle {
  key: string;
  hints: number;
  /** Cost in coins — the only currency this shop spends; there is no real-money IAP yet. */
  price: number;
  /** Bundle art, sized up with the bundle so the tiers read at a glance. */
  art: ArtName;
}

/**
 * The shop's coin-priced offer table. Real-money coin packs and Remove Ads are
 * Phase 4 (IAP) and are intentionally not rendered here — a placeholder alert
 * button would just be a dishonest dead tap target, so they are hidden
 * instead until the real purchase flow ships.
 */
const HINT_BUNDLES: HintBundle[] = [
  { key: 'small', hints: 5, price: 100, art: 'coins-500' },
  { key: 'medium', hints: 15, price: 250, art: 'coins-1200' },
  { key: 'large', hints: 30, price: 450, art: 'gold-chest' },
];

const EMPTY_WALLET: Wallet = { coins: 0, hints: 0 };

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
        const next = await (
          await getWalletRepository()
        ).record({
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
              <Art name="coin" size={22} />
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

          {HINT_BUNDLES.map((bundle) => (
            <HintBundleRow
              key={bundle.key}
              bundle={bundle}
              affordable={wallet.coins >= bundle.price}
              purchasing={purchasing === bundle.key}
              onBuy={() => onBuy(bundle)}
            />
          ))}

          {/* Three bundles leave most of a tall screen blank. A mascot makes the
              tail read as deliberate rather than as content that failed to load. */}
          <View style={styles.footerArt}>
            <Art name="happy-duck" size={132} />
            <Text style={styles.footerNote}>More ways to spend coins are coming.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function HintBundleRow({
  bundle,
  affordable,
  purchasing,
  onBuy,
}: {
  bundle: HintBundle;
  affordable: boolean;
  purchasing: boolean;
  onBuy: () => void;
}) {
  const disabled = !affordable || purchasing;

  return (
    <PopSurface fill={colors.surface} radius={radii.md} contentStyle={styles.rowBody}>
      {/* The bundle art carries the tier, so the row no longer needs a coloured
          accent frame — which also removes the ink-on-saturated-fill contrast
          problem that frame existed to work around. */}
      <Art name={bundle.art} size={60} style={disabled ? styles.artDisabled : undefined} />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{bundle.hints} hints</Text>
        <Text style={styles.rowMeta}>
          {affordable ? 'Spend one to reveal a piece' : 'Not enough coins yet'}
        </Text>
      </View>
      <PopButton
        label={purchasing ? 'Buying…' : `${bundle.price}`}
        icon={purchasing ? undefined : <Art name="coin" size={18} />}
        tone="honey"
        size="sm"
        disabled={disabled}
        accessibilityLabel={`Buy ${bundle.hints} hints for ${bundle.price} coins`}
        onPress={onBuy}
      />
    </PopSurface>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  safe: { flex: 1 },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  balanceText: { ...typography.heading, fontSize: 17, color: colors.ink },
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
  sectionTitle: { ...typography.title, fontSize: 22, color: colors.headingGreen },
  sectionMeta: { ...typography.caption, color: colors.inkMuted },
  rowBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  artDisabled: { opacity: 0.45 },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { ...typography.heading, fontSize: 18, color: colors.ink },
  rowMeta: { ...typography.caption, color: colors.inkMuted },
  footerArt: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl },
  footerNote: { ...typography.caption, color: colors.inkMuted, textAlign: 'center' },
});
