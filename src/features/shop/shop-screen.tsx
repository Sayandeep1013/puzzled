import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/shared/theme';
import { PaperBackground, ScreenHeader, SketchButton, SketchFrame, SketchIcon } from '@/shared/ui';

const COIN_PACKS = [
  { coins: 200, price: '₹150' },
  { coins: 500, price: '₹250' },
  { coins: 1100, price: '₹450' },
  { coins: 2500, price: '₹850' },
];

export function ShopScreen() {
  const buy = (what: string) => Alert.alert('Coming soon', `${what} purchases are not wired up yet.`);

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader
          title="Shop"
          right={
            <View style={styles.balance}>
              <SketchIcon name="coin" size={18} color={colors.gold} />
              <Text style={styles.balanceText}>9866</Text>
            </View>
          }
        />
        <ScrollView contentContainerStyle={styles.content}>
          <SketchFrame fill={colors.sage} radius={radii.md} seed={9}>
            <View style={styles.adRow}>
              <SketchIcon name="noads" size={30} color={colors.inkSoft} />
              <View style={styles.adCopy}>
                <Text style={styles.adTitle}>Remove Ads</Text>
                <Text style={styles.adSub}>Play without interruptions.</Text>
              </View>
              <View style={styles.priceTag}>
                <Text style={styles.priceText}>₹250</Text>
              </View>
            </View>
          </SketchFrame>

          <Text style={styles.sectionTitle}>Coin Packs</Text>
          {COIN_PACKS.map((pack) => (
            <SketchFrame key={pack.coins} fill={colors.surface} radius={radii.md} seed={pack.coins}>
              <View style={styles.packRow}>
                <SketchIcon name="coin" size={30} color={colors.gold} />
                <Text style={styles.packCoins}>{pack.coins.toLocaleString()} coins</Text>
                <View style={styles.priceTag}>
                  <Text style={styles.priceText}>{pack.price}</Text>
                </View>
              </View>
            </SketchFrame>
          ))}

          <SketchButton
            label="Restore Purchases"
            variant="plain"
            style={styles.restore}
            onPress={() => buy('Restore')}
          />
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
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
  adRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  adCopy: { flex: 1 },
  adTitle: { ...typography.heading, fontSize: 18, color: colors.inkSoft },
  adSub: { ...typography.caption, color: colors.inkMuted },
  sectionTitle: { ...typography.heading, color: colors.ink, marginTop: spacing.sm },
  packRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  packCoins: { ...typography.heading, fontSize: 18, color: colors.ink, flex: 1 },
  priceTag: {
    backgroundColor: colors.gold,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: colors.sketch,
  },
  priceText: { ...typography.bodyStrong, fontSize: 14, color: colors.inkSoft },
  restore: { marginTop: spacing.md },
});
