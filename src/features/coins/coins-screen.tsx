import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ACHIEVEMENT_REWARD,
  coinsForCompletion,
  DAILY_BONUS,
  dailyBonusFor,
  dateKey,
  getWalletRepository,
  streakFrom,
  type LedgerEntry,
  type Wallet,
} from '@/data';
import { type ArtName } from '@/shared/art';
import { useTheme } from '@/shared/theme-context';
import { createThemedStyles } from '@/shared/themed-styles';
import { radii, spacing, typography } from '@/shared/theme';
import { Art, PopButton, PopHeader, PopIcon, PopSurface, Text, ThemeGround } from '@/shared/ui';

/**
 * Where coins come from.
 *
 * This replaces the Shop, which sold hints — and hints are free now, so it was
 * a storefront with nothing behind the counter. Rather than leave a dead screen
 * reachable from Profile, it becomes the page the coin `+` on Home opens.
 *
 * Nothing here costs money. There is no billing integration and no ads, so
 * every source below is something the player earns by playing. That is a
 * deliberate stage, not an oversight: the balance is a real append-only ledger
 * already, so adding a paid source later is a new row reason, not a rewrite.
 */

/** The daily bonus is claimed once per calendar day, keyed on that day. */
const DAILY_BONUS_REASON = 'streak-bonus' as const;

interface CoinsData {
  wallet: Wallet | null;
  /** `dateKey`s the daily bonus has already been claimed for, newest first. */
  claimedDays: string[];
}

const EMPTY: CoinsData = { wallet: null, claimedDays: [] };

async function loadCoinsData(): Promise<CoinsData> {
  try {
    const repository = await getWalletRepository();
    const [wallet, history] = await Promise.all([repository.balance(), repository.history()]);
    return {
      wallet,
      claimedDays: history
        .filter((entry: LedgerEntry) => entry.reason === DAILY_BONUS_REASON && entry.ref != null)
        .map((entry: LedgerEntry) => entry.ref as string),
    };
  } catch {
    // Same contract as Home: no balance is better than a wrong one.
    return EMPTY;
  }
}

export function CoinsScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [data, setData] = useState<CoinsData>(EMPTY);
  const [claiming, setClaiming] = useState(false);

  // Recomputed on focus rather than at mount, so a bonus claimed here and a
  // puzzle finished elsewhere both show up without a reload.
  const [today, setToday] = useState(() => dateKey(new Date()));

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const now = dateKey(new Date());
      if (now !== today) {
        // Crossing midnight with the app open makes yesterday's claim look like
        // today's, and the bonus would appear spent when it is not.
        setToday(now);
        return () => {
          active = false;
        };
      }
      loadCoinsData().then((next) => {
        if (active) setData(next);
      });
      return () => {
        active = false;
      };
    }, [today]),
  );

  /**
   * Everything the bonus card shows, derived in one memo.
   *
   * Memoised rather than computed inline because `onClaim` closes over
   * `priorStreak`, and each of these is built from a freshly-filtered array —
   * React Compiler refuses to optimise a callback whose dependency it cannot
   * prove stable, and it is right to: an amount that changed identity every
   * render is an amount that could be read stale at the moment it is spent.
   *
   * `streakFrom` already implements exactly this walk for the daily puzzle, and
   * it counts back from yesterday when today is missing — which is the case
   * here whenever the bonus is still unclaimed.
   */
  const { claimedToday, priorStreak, streakAfterClaim, amount } = useMemo(() => {
    const claimed = data.claimedDays.includes(today);
    const prior = streakFrom(
      data.claimedDays.filter((day) => day !== today),
      today,
    );
    return {
      claimedToday: claimed,
      priorStreak: prior,
      streakAfterClaim: claimed ? streakFrom(data.claimedDays, today) : prior + 1,
      amount: claimed ? 0 : dailyBonusFor(prior),
    };
  }, [data.claimedDays, today]);

  const onClaim = useCallback(() => {
    if (claiming || claimedToday) {
      return;
    }
    setClaiming(true);
    void (async () => {
      try {
        // `recordOnce` keyed on the day, so a double tap — or a second device
        // clock jumping back — cannot pay twice.
        await (
          await getWalletRepository()
        ).recordOnce({
          deltaCoins: dailyBonusFor(priorStreak),
          deltaHints: 0,
          reason: DAILY_BONUS_REASON,
          ref: today,
        });
      } catch {
        // Best-effort; the refresh below shows whatever actually landed rather
        // than asserting a credit that may not have happened.
      }
      const next = await loadCoinsData();
      setData(next);
      setClaiming(false);
    })();
  }, [claiming, claimedToday, priorStreak, today]);

  return (
    <View style={styles.root}>
      <ThemeGround />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <PopHeader title="Coins" onBack={() => router.back()} />

        <ScrollView contentContainerStyle={styles.content}>
          <PopSurface
            fill={theme.colors.honey}
            radius={radii.lg}
            contentStyle={styles.balanceFrame}
          >
            <View style={styles.balanceBody}>
              <Art name="coin" size={54} />
              <View style={styles.balanceCopy}>
                <Text style={styles.balanceLabel}>YOUR BALANCE</Text>
                <Text style={styles.balanceValue} numberOfLines={1}>
                  {data.wallet?.coins ?? '—'}
                </Text>
              </View>
            </View>
          </PopSurface>

          <Text style={styles.sectionTitle}>Earn more</Text>

          {/* The daily bonus is the only thing on this screen with a button,
              because it is the only one that pays out here rather than by
              playing something. */}
          <PopSurface fill={theme.colors.surface} radius={radii.lg} contentStyle={styles.cardBody}>
            <View style={styles.cardHead}>
              <Art name="calendar" size={44} />
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>Daily bonus</Text>
                {/* What today paid, not that today was paid — the badge at the
                    bottom of this card already says "Claimed today", and this
                    line sat directly above it saying the same three words. */}
                <Text style={styles.cardMeta}>
                  {claimedToday
                    ? `+${dailyBonusFor(priorStreak)} coins today.`
                    : `${amount} coins, waiting for you.`}
                </Text>
              </View>
            </View>

            {/* Never a restatement of the line above it: while both branches said
                "come back tomorrow", the claimed card spent two of its three lines
                saying the same sentence twice. This one carries the streak, or
                the number the streak is worth. */}
            <Text style={styles.streakLine}>
              {streakAfterClaim > 1
                ? `${streakAfterClaim} days in a row — the bonus grows to ${DAILY_BONUS.cap} coins.`
                : claimedToday
                  ? `Tomorrow it is ${dailyBonusFor(streakAfterClaim)} coins.`
                  : 'Come back tomorrow and it grows.'}
            </Text>

            {claimedToday ? (
              // Done, not broken. A disabled `PopButton` sits at 45% opacity,
              // which read as a control that had failed rather than as a reward
              // already collected.
              <View
                style={styles.claimed}
                accessible
                accessibilityLabel="Daily bonus claimed today"
              >
                <PopIcon name="check" size={20} color={theme.colors.grassDeep} />
                <Text style={styles.claimedLabel} numberOfLines={1}>
                  Claimed today
                </Text>
              </View>
            ) : (
              <PopButton
                label={claiming ? 'Claiming…' : `Claim ${amount}`}
                tone="grass"
                disabled={claiming}
                icon={<Art name="coin" size={22} />}
                onPress={onClaim}
              />
            )}
          </PopSurface>

          {/* `dismissTo`, not `push`: the Puzzles tab is *under* this screen in
              the stack, and pushing it puts a tab navigator on top of a stack
              screen — the dock reappears, but so does a back arrow to a coin
              page the player has finished with. This unwinds to the tab that is
              already there. */}
          <EarnRow
            art="puzzle-quad"
            title="Finish a puzzle"
            meta={`Bigger boards pay more — up to ${coinsForCompletion(10)} coins for a 10×10.`}
            onPress={() => router.dismissTo('/puzzles')}
          />
          <EarnRow
            art="collection"
            title="Today's challenge"
            meta="One picked puzzle a day, with a bonus for finishing it."
            onPress={() => router.push('/daily')}
          />
          {/* Achievements belongs here, with the other things that pay. It used
              to sit under a second "Earn more" heading *below* "Spend them",
              so the page read Earn / Spend / Earn and the reader could not tell
              whether the last row cost coins or paid them. */}
          <EarnRow
            art="my-trophies"
            title="Achievements"
            meta={`${ACHIEVEMENT_REWARD} coins each, paid the moment one unlocks.`}
            onPress={() => router.push('/achievements')}
          />

          <Text style={styles.sectionTitle}>Spend them</Text>
          <EarnRow
            art="sticker-book"
            title="Themes"
            meta="Change how the whole app looks. Unlocking is permanent."
            onPress={() => router.push('/themes')}
          />

          <View style={styles.footerArt}>
            <Art name="happy-duck" size={124} />
            <Text style={styles.footerNote}>
              Every coin here is earned by playing. Nothing costs money.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** A place coins come from that is earned elsewhere — so the row navigates. */
function EarnRow({
  art,
  title,
  meta,
  onPress,
}: {
  art: ArtName;
  title: string;
  meta: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <PopSurface fill={theme.colors.surface} radius={radii.md} contentStyle={styles.earnBody}>
      <Art name={art} size={38} />
      <View style={styles.cardCopy}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardMeta}>{meta}</Text>
      </View>
      <PopButton label="Go" tone="sky" size="sm" accessibilityLabel={title} onPress={onPress} />
    </PopSurface>
  );
}

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.paper },
    safe: { flex: 1 },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.md,
      width: '100%',
      maxWidth: 620,
      alignSelf: 'center',
    },
    // Honey is light enough for direct ink text (10.08:1), so the balance needs no
    // inner white body the way the saturated fills do.
    balanceFrame: { padding: spacing.lg },
    balanceBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    balanceCopy: { flex: 1, gap: 2 },
    balanceLabel: { ...typography.label, fontSize: 11, color: theme.colors.inkMuted },
    balanceValue: { ...typography.hero, fontSize: 38, color: theme.colors.ink },
    sectionTitle: { ...typography.heading, color: theme.colors.ink, marginTop: spacing.sm },
    cardBody: { padding: spacing.md, gap: spacing.md },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    cardCopy: { flex: 1, gap: 2 },
    cardTitle: { ...typography.heading, fontSize: 18, color: theme.colors.ink },
    cardMeta: { ...typography.caption, color: theme.colors.inkMuted },
    streakLine: { ...typography.caption, color: theme.colors.headingGreen },
    claimed: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radii.md,
      backgroundColor: theme.colors.paper,
    },
    claimedLabel: {
      ...typography.heading,
      fontSize: 18,
      color: theme.colors.ink,
      paddingHorizontal: 2,
    },
    earnBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
    },
    footerArt: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl },
    footerNote: { ...typography.caption, color: theme.colors.inkMuted, textAlign: 'center' },
  }),
);
