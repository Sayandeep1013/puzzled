import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPuzzleById, resolvePuzzleImageSource } from '@/data';
import { formatClock } from '@/features/game/play-clock';
import { radii, spacing, typography } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';
import { createThemedStyles } from '@/shared/themed-styles';
import { Art, PopButton, PopSurface, Text, ThemeGround } from '@/shared/ui';

export function ResultsScreen({
  puzzleId,
  size,
  timeMs,
  coins = 0,
}: {
  puzzleId: string;
  size: number;
  /**
   * Play time in **milliseconds** — the same figure written to
   * `session.elapsedMs`, so this screen and Statistics can no longer disagree
   * about how long the puzzle took. It used to be a count of seconds ticked on
   * this screen's own mount, which meant a resumed puzzle reported only the
   * final sitting.
   */
  timeMs: number;
  /** Coins credited for this completion (Task 14), shown when positive. */
  coins?: number;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const pieces = size * size;
  /** The finished artwork, which the mockup makes the centrepiece of this screen. */
  const [image, setImage] = useState<number | string | null>(null);

  useEffect(() => {
    let active = true;
    getPuzzleById(puzzleId)
      .then((puzzle) => {
        if (active) setImage(puzzle ? resolvePuzzleImageSource(puzzle) : null);
      })
      .catch(() => {
        // Best-effort: the trophy fallback below still celebrates the win.
      });
    return () => {
      active = false;
    };
  }, [puzzleId]);

  return (
    <View style={styles.root}>
      <ThemeGround />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.body}>
          {/* The mockup's celebration screen is the one saturated ground in the
              app, so every text colour here is white rather than ink. */}
          <Text style={styles.title}>Amazing!</Text>
          <Text style={styles.subtitle}>You completed the puzzle!</Text>

          {/* The mockup puts the finished picture here, not a generic trophy —
              the artwork you just assembled is the reward. The trophy remains as
              a fallback for a puzzle whose image cannot be resolved. */}
          {image != null ? (
            <PopSurface
              fill={theme.colors.surface}
              radius={radii.lg}
              elevation="raised"
              contentStyle={styles.artFrame}
            >
              <Image
                source={typeof image === 'number' ? image : { uri: image }}
                style={styles.art}
                resizeMode="cover"
              />
            </PopSurface>
          ) : (
            <Art name="cup-star" size={150} />
          )}

          <View style={styles.stats}>
            <Stat label="TIME" value={timeMs > 0 ? formatClock(timeMs) : '—'} />
            <View style={styles.statDivider} />
            <Stat label="PIECES" value={String(pieces)} />
            {coins > 0 ? (
              <>
                <View style={styles.statDivider} />
                <Stat label="COINS" value={`+${coins}`} art="coin" />
              </>
            ) : null}
          </View>

          <Art name="bear-excited" size={128} style={styles.mascot} />
        </View>

        <View style={styles.footer}>
          <PopButton
            label="Play Again"
            tone="honey"
            icon={<Art name="restart" size={24} />}
            /*
             * `dismissTo`, not `replace`.
             *
             * The Game screen this was pushed from is still in the stack, so
             * replacing Results with a Game put a *second* Game on top of the
             * first — and a third on the next replay, each one a mounted board
             * with its own Skia canvas, all of them reachable by pressing back.
             * `dismissTo` pops back to the Game that is already there (and falls
             * back to a replace if there isn't one, e.g. a deep link straight to
             * Results). The board itself starts over: see the game screen's
             * "returning to a finished board" effect.
             */
            onPress={() =>
              router.dismissTo({
                pathname: '/game/[puzzleId]',
                params: { puzzleId, size: String(size) },
              })
            }
          />
          <PopButton
            label="Back Home"
            tone="grass"
            icon={<Art name="quit-home" size={24} />}
            // `dismissTo`, not `dismissAll`: popping to the top of the stack lands
            // on whichever tab was showing when the run started, so a puzzle begun
            // from the Puzzles tab put "Back Home" on the Puzzles tab. Naming the
            // route also covers the deep-link case — `dismissTo` replaces when the
            // href is not in the stack, which `dismissAll` cannot do.
            onPress={() => router.dismissTo('/')}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

/** One figure in the results row. Cream card so the numerals keep ink contrast. */
function Stat({
  label,
  value,
  art,
}: {
  label: string;
  value: string;
  art?: 'coin' | 'star' | 'clock';
}) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <PopSurface fill={theme.colors.surface} radius={radii.md} contentStyle={styles.statInner}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        {art ? <Art name={art} size={20} /> : null}
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </PopSurface>
  );
}

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.backgrounds.results },
    safe: { flex: 1 },
    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      padding: spacing.lg,
    },
    artFrame: { padding: spacing.sm },
    art: { width: 236, height: 236, borderRadius: radii.md },
    title: { ...typography.hero, color: theme.colors.honey },
    subtitle: { ...typography.heading, color: theme.colors.onFill, textAlign: 'center' },
    mascot: { marginTop: spacing.xs },
    stats: {
      flexDirection: 'row',
      // Wraps rather than running off both screen edges: the row is centred and
      // nothing clips it, so three cards at a raised font scale simply left the
      // screen. Wrapping drops COINS onto a second line instead of hiding it.
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    statInner: { alignItems: 'center', gap: 2, paddingHorizontal: spacing.md, paddingVertical: 10 },
    statLabel: { ...typography.label, fontSize: 11, color: theme.colors.inkMuted },
    statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statValue: { ...typography.title, fontSize: 26, color: theme.colors.ink },
    statDivider: { width: 6 },
    footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  }),
);
