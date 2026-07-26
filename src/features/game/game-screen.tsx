import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Image as RNImage, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  coinsForCompletion,
  getProgressRepository,
  getPuzzleById,
  getSettingsRepository,
  getWalletRepository,
  resolvePuzzleImageSource,
  sessionStorageKey,
  type Wallet,
} from '@/data';
import {
  cellSizeForGrid,
  countLockedPieces,
  createPlayablePuzzle,
  createSeededRng,
  dropPiece,
  expectedPieceCount,
  findGeometry,
  isSessionCompatible,
  isSupportedGridSize,
  type GameSession,
  type GridSize,
  type PieceState,
  type PlayablePuzzle,
  type PuzzleDefinition,
} from '@/game-engine';
import { border, colors, radii, spacing, typography } from '@/shared/theme';
import { PopButton, PopIcon, PopSheet, PopSurface, PopToggle, type PopIconName } from '@/shared/ui';

import { setMusicEnabled, setSfxEnabled } from './board-audio';
import { FX, setHapticsEnabled } from './board-fx';
import { PuzzleBoard } from './puzzle-board';

type OverlayKind = 'none' | 'pause' | 'hint' | 'preview';

function buildPlayable(puzzle: PuzzleDefinition, gridSize: GridSize): PlayablePuzzle {
  const sized: PuzzleDefinition = { ...puzzle, gridSize };
  return createPlayablePuzzle({
    puzzle: sized,
    sessionId: `local-${puzzle.id}-${gridSize}`,
    now: new Date().toISOString(),
    cellSize: cellSizeForGrid(gridSize),
    layoutMode: 'tray',
  });
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Unplaced pieces below the board's own footprint are resting in the tray
 * (see `layout.ts`'s `trayPositions`, which always places them at
 * `y >= boardSize.height`); anything else unlocked is either loose on the
 * board or still animating into place.
 */
function isTrayPiece(piece: PieceState, boardHeight: number): boolean {
  return !piece.isLocked && piece.position.y >= boardHeight;
}

interface GameScreenProps {
  puzzleId: string;
  /** Optional starting size, e.g. from a "Continue" deep link. */
  initialGridSize?: GridSize;
}

type CatalogState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'missing-art' }
  | { status: 'ready'; puzzle: PuzzleDefinition; imageSource: number | string };

export function GameScreen({ puzzleId, initialGridSize }: GameScreenProps) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogState>({ status: 'loading' });
  const [gridSize, setGridSize] = useState<GridSize | null>(initialGridSize ?? null);
  const [playable, setPlayable] = useState<PlayablePuzzle | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  /** Bumped on reset to force a fresh board with a freshly measured world. */
  const [generation, setGeneration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [overlay, setOverlay] = useState<OverlayKind>('none');
  const [sound, setSound] = useState(true);
  const [music, setMusic] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [highlightEdges, setHighlightEdges] = useState(false);
  const [wallet, setWallet] = useState<Wallet | null>(null);

  // Tracks whether the component is still mounted, for async work (like the
  // hint spend below) that must not call state setters after unmount.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Load the catalog entry + artwork once per puzzle.
  useEffect(() => {
    let active = true;

    (async () => {
      const puzzle = await getPuzzleById(puzzleId);
      if (!active) return;

      if (!puzzle) {
        setCatalog({ status: 'missing' });
        return;
      }

      const imageSource = resolvePuzzleImageSource(puzzle);
      if (imageSource == null) {
        setCatalog({ status: 'missing-art' });
        return;
      }

      setCatalog({ status: 'ready', puzzle, imageSource });
      // Default to the requested size, else the catalog's own size.
      setGridSize((current) => current ?? puzzle.gridSize);
    })();

    return () => {
      active = false;
    };
  }, [puzzleId]);

  // Build the board and load saved progress whenever the puzzle or size changes.
  useEffect(() => {
    if (catalog.status !== 'ready' || gridSize == null) {
      return;
    }

    let active = true;
    const { puzzle } = catalog;
    const built = buildPlayable(puzzle, gridSize);

    (async () => {
      let restored: GameSession | null = null;
      try {
        const saved = await (await getProgressRepository()).getSession(puzzle.id, gridSize);
        if (saved && isSessionCompatible(saved, built.generated.puzzle, built.generated.pieces)) {
          restored = saved;
        }
      } catch {
        // A progress read failure must not block play; fall back to a new board.
      }

      if (!active) return;
      setPlayable(built);
      setSession(restored ?? built.session);
    })();

    return () => {
      active = false;
    };
  }, [catalog, gridSize]);

  // Load the persisted Sound/Music/Haptics settings once to seed the pause
  // menu's toggle state. The toggles themselves push every change straight
  // into board-audio/board-fx and back out to the settings repository.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const current = await (await getSettingsRepository()).get();
        if (!active) return;
        setSound(current.sound);
        setMusic(current.music);
        setHaptics(current.haptics);
      } catch {
        // Settings are best-effort; the defaults already shown stay in effect.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Wallet balance drives the live hint count on the toolbar and the "Show me
  // one" gate. Best-effort: a failed read just leaves the toolbar without a
  // badge instead of crashing the screen.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const balance = await (await getWalletRepository()).balance();
        if (!active) return;
        setWallet(balance);
      } catch {
        // A stale/missing balance is not worth surfacing.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Debounced write-behind: dragging produces a session object per drop.
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!session || session.status === 'not-started') {
      return;
    }

    if (pendingSave.current) {
      clearTimeout(pendingSave.current);
    }

    pendingSave.current = setTimeout(() => {
      void (async () => {
        try {
          await (await getProgressRepository()).saveSession(session);
        } catch {
          // Progress is best-effort; a failed write should never interrupt play.
        }
      })();
    }, 400);

    return () => {
      if (pendingSave.current) {
        clearTimeout(pendingSave.current);
      }
    };
  }, [session]);

  const complete = session?.status === 'completed';

  // Tick a play clock while the board is live, unfinished, and not paused.
  useEffect(() => {
    if (!playable || complete || overlay === 'pause') {
      return;
    }
    const id = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [playable, complete, generation, overlay]);

  // On completion, hand off to the results screen once — but only after a short
  // beat so the board's celebration (confetti + success haptic) is actually seen.
  // `handedOff` prevents a same-mount double navigation/credit (e.g. a spurious
  // re-render while `complete` is still true), but it is a per-mount ref and
  // resets on remount — it CANNOT prevent a re-credit across "Play Again"
  // (results screen → router.replace back into a fresh GameScreen mount, which
  // restores the same completed session and fires this effect again). The
  // coin credit's actual correctness comes from `recordOnce` below, keyed on
  // the (puzzle, size) identity, so a given board pays out exactly once for
  // its lifetime no matter how many times it is remounted or replayed.
  const handedOff = useRef(false);
  useEffect(() => {
    if (!complete || handedOff.current || catalog.status !== 'ready' || gridSize == null) {
      return;
    }
    handedOff.current = true;
    const completedPuzzleId = catalog.puzzle.id;
    const earnedCoins = coinsForCompletion(gridSize);

    void (async () => {
      try {
        await (await getWalletRepository()).recordOnce({
          deltaCoins: earnedCoins,
          deltaHints: 0,
          reason: 'puzzle-complete',
          ref: sessionStorageKey(completedPuzzleId, gridSize),
        });
      } catch {
        // Best-effort: a failed credit must not block the trip to results.
      }
    })();

    const timer = setTimeout(() => {
      router.push({
        pathname: '/results/[puzzleId]',
        params: {
          puzzleId: completedPuzzleId,
          size: String(gridSize),
          time: String(elapsed),
          coins: String(earnedCoins),
        },
      });
    }, FX.celebrateMs);
    return () => clearTimeout(timer);
  }, [complete, catalog, gridSize, elapsed, router]);

  const onSessionChange = useCallback((next: GameSession) => {
    setSession(next);
  }, []);

  const onReset = useCallback(() => {
    if (catalog.status !== 'ready' || gridSize == null) {
      return;
    }

    if (pendingSave.current) {
      clearTimeout(pendingSave.current);
      pendingSave.current = null;
    }

    const fresh = buildPlayable(catalog.puzzle, gridSize);
    setPlayable(fresh);
    setSession(fresh.session);
    setGeneration((value) => value + 1);
    setElapsed(0);
    handedOff.current = false;

    void (async () => {
      try {
        await (await getProgressRepository()).deleteSession(catalog.puzzle.id, gridSize);
      } catch {
        // Local board is already reset; a stale row is overwritten on the next save.
      }
    })();
  }, [catalog, gridSize]);

  // Reorders only the pieces still waiting in the tray, leaving locked and
  // loose-on-board pieces exactly where they are. `PuzzleBoard` derives tray
  // slot order straight from `session.pieces`' array order (filtered to
  // unplaced + off-board), so permuting that subset is enough to reshuffle
  // the tray without touching the engine.
  const onShuffleTray = useCallback(() => {
    if (!session || !playable) {
      return;
    }
    const boardHeight = playable.generated.boardSize.height;
    const trayIndices: number[] = [];
    session.pieces.forEach((piece, index) => {
      if (isTrayPiece(piece, boardHeight)) {
        trayIndices.push(index);
      }
    });
    if (trayIndices.length < 2) {
      return;
    }

    const rng = createSeededRng(`${session.id}:shuffle:${Date.now()}`);
    const shuffledGroup = trayIndices.map((index) => session.pieces[index]);
    for (let i = shuffledGroup.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [shuffledGroup[i], shuffledGroup[j]] = [shuffledGroup[j], shuffledGroup[i]];
    }

    const nextPieces = [...session.pieces];
    trayIndices.forEach((originalIndex, i) => {
      nextPieces[originalIndex] = shuffledGroup[i];
    });
    onSessionChange({ ...session, pieces: nextPieces, updatedAt: new Date().toISOString() });
  }, [session, playable, onSessionChange]);

  // "Show me one": debits a hint BEFORE placing anything, then locks a random
  // unplaced piece at its solved position via the engine's own `dropPiece`
  // (position === solvedPosition with a zero threshold always snaps+locks).
  //
  // `hintSpendInFlight` closes a fast-double-tap window: the `disabled` prop
  // on the button and the `wallet.hints > 0` check just below both read the
  // same closured `wallet` state, which only updates once the async debit
  // resolves. Two taps fired inside that window would both pass the check,
  // both debit, and both place a piece for the price of one hint. The ref
  // flips to `true` synchronously — before the first `await` — so a second
  // tap during the in-flight debit is a no-op regardless of stale state.
  const hintSpendInFlight = useRef(false);
  const onSpendHint = useCallback(() => {
    if (!session || !playable) {
      return;
    }
    if ((wallet?.hints ?? 0) <= 0) {
      return;
    }
    if (hintSpendInFlight.current) {
      return;
    }
    const unplaced = session.pieces.filter((piece) => !piece.isLocked);
    if (unplaced.length === 0) {
      setOverlay('none');
      return;
    }

    hintSpendInFlight.current = true;
    void (async () => {
      try {
        let nextWallet: Wallet;
        try {
          nextWallet = await (await getWalletRepository()).record({
            deltaCoins: 0,
            deltaHints: -1,
            reason: 'hint-spend',
            ref: puzzleId,
          });
        } catch {
          // Debit failed — do not reveal a hint the player was never charged for.
          return;
        }
        if (!mounted.current) return;
        setWallet(nextWallet);

        const target = unplaced[Math.floor(Math.random() * unplaced.length)];
        const geometry = findGeometry(playable.generated.pieces, target.pieceId);
        const now = new Date().toISOString();
        const placed = dropPiece({
          session,
          pieceId: target.pieceId,
          position: geometry.solvedPosition,
          solvedPosition: geometry.solvedPosition,
          now,
          elapsedMs: session.elapsedMs,
          snapThreshold: 0,
        });
        if (!mounted.current) return;
        onSessionChange(placed);
        setOverlay('none');
      } finally {
        // Cleared regardless of success/failure/early-return so the next tap
        // (or the same tap after a debit failure) is never permanently locked out.
        hintSpendInFlight.current = false;
      }
    })();
  }, [session, playable, wallet, puzzleId, onSessionChange]);

  const onToggleSound = useCallback((next: boolean) => {
    setSound(next);
    setSfxEnabled(next);
    void (async () => {
      try {
        await (await getSettingsRepository()).set({ sound: next });
      } catch {
        // Best-effort persistence; the live toggle already took effect.
      }
    })();
  }, []);

  const onToggleMusic = useCallback((next: boolean) => {
    setMusic(next);
    setMusicEnabled(next);
    void (async () => {
      try {
        await (await getSettingsRepository()).set({ music: next });
      } catch {
        // Best-effort persistence; the live toggle already took effect.
      }
    })();
  }, []);

  const onToggleHaptics = useCallback((next: boolean) => {
    setHaptics(next);
    setHapticsEnabled(next);
    void (async () => {
      try {
        await (await getSettingsRepository()).set({ haptics: next });
      } catch {
        // Best-effort persistence; the live toggle already took effect.
      }
    })();
  }, []);

  if (catalog.status === 'missing' || catalog.status === 'missing-art') {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <View style={styles.centered}>
            <Text style={styles.bigTitle}>
              {catalog.status === 'missing' ? 'Puzzle not found' : 'Artwork missing'}
            </Text>
            <Text style={styles.meta}>
              {catalog.status === 'missing'
                ? `No catalog entry for “${puzzleId}”.`
                : `“${puzzleId}” has no bundled image registered.`}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Until the rebuilt board and the selected size agree, keep showing the loader —
  // otherwise a size switch briefly renders the new count over the old geometry.
  if (
    catalog.status !== 'ready' ||
    !playable ||
    !session ||
    gridSize == null ||
    playable.generated.puzzle.gridSize !== gridSize
  ) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <View style={styles.centered}>
            <Text style={styles.bigTitle}>Loading puzzle…</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const { generated } = playable;
  const locked = countLockedPieces(session);
  const total = expectedPieceCount(gridSize);
  const trayCount = session.pieces.filter((piece) => isTrayPiece(piece, generated.boardSize.height)).length;
  const hintCount = wallet?.hints ?? 0;

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              onPress={() => router.back()}
            >
              <PopIcon name="back" size={26} color={colors.ink} />
            </Pressable>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {catalog.puzzle.title}
              </Text>
              <Text style={styles.headerMeta}>
                {locked} / {total} placed
              </Text>
            </View>

            <View style={styles.headerRight}>
              <PopSurface fill={colors.surface} radius={radii.md} contentStyle={styles.clockInner}>
                <Text style={styles.clock}>{formatClock(elapsed)}</Text>
              </PopSurface>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pause"
                hitSlop={10}
                onPress={() => setOverlay('pause')}
              >
                <PopIcon name="gear" size={26} color={colors.ink} />
              </Pressable>
            </View>
          </View>

          <View style={styles.boardShell}>
            <PuzzleBoard
              key={`${generated.puzzle.id}:${generated.puzzle.revision}:${gridSize}:${generation}`}
              generated={generated}
              session={session}
              imageSource={catalog.imageSource}
              onSessionChange={onSessionChange}
              highlightEdges={highlightEdges}
            />
          </View>

          <View style={styles.toolbar}>
            <ToolButton
              icon="restart"
              label="Shuffle"
              disabled={trayCount < 2}
              onPress={onShuffleTray}
            />
            <ToolButton
              icon="edges"
              label="Edges"
              active={highlightEdges}
              onPress={() => setHighlightEdges((on) => !on)}
            />
            <ToolButton icon="hint" label="Hint" badge={hintCount} onPress={() => setOverlay('hint')} />
            <ToolButton icon="eye" label="Preview" onPress={() => setOverlay('preview')} />
          </View>
        </View>

        {overlay === 'pause' ? (
          <PopSheet title="Paused" onDismiss={() => setOverlay('none')}>
            <View style={styles.sheetBody}>
              <View style={styles.pauseRows}>
                <SettingRow label="Sound">
                  <PopToggle value={sound} onChange={onToggleSound} accessibilityLabel="Sound" />
                </SettingRow>
                <SettingRow label="Music">
                  <PopToggle value={music} onChange={onToggleMusic} accessibilityLabel="Music" />
                </SettingRow>
                <SettingRow label="Haptics">
                  <PopToggle value={haptics} onChange={onToggleHaptics} accessibilityLabel="Haptics" />
                </SettingRow>
              </View>
              <PopButton label="Resume" tone="grape" onPress={() => setOverlay('none')} />
              <PopButton
                label="Restart"
                tone="sunshine"
                onPress={() => {
                  setOverlay('none');
                  onReset();
                }}
              />
              <PopButton
                label="Exit Puzzle"
                tone="surface"
                onPress={() => {
                  setOverlay('none');
                  router.back();
                }}
              />
            </View>
          </PopSheet>
        ) : null}

        {overlay === 'hint' ? (
          <PopSheet title="Hint" onDismiss={() => setOverlay('none')}>
            <View style={styles.sheetBody}>
              <View style={styles.hintHero}>
                <PopIcon name="hint" size={64} color={colors.sunshine} />
              </View>
              <Text style={styles.hintBalance}>
                {hintCount} {hintCount === 1 ? 'hint' : 'hints'} available
              </Text>
              <PopButton
                label="Show me one — 1 hint"
                tone="grape"
                disabled={hintCount <= 0}
                onPress={onSpendHint}
              />
              {hintCount <= 0 ? <Text style={styles.hintOutText}>Get more in the Shop</Text> : null}
              <PopButton
                label={highlightEdges ? 'Hide edges' : 'Highlight edges'}
                tone="sky"
                onPress={() => {
                  setHighlightEdges((on) => !on);
                  setOverlay('none');
                }}
              />
              <PopButton label="Preview image" tone="sunshine" onPress={() => setOverlay('preview')} />
            </View>
          </PopSheet>
        ) : null}

        {overlay === 'preview' ? (
          <PopSheet title="Preview" onDismiss={() => setOverlay('none')}>
            <View style={styles.sheetBody}>
              <PopSurface fill={colors.sunshine} radius={radii.md} contentStyle={styles.previewFrame}>
                <View style={styles.previewImageWrap}>
                  <RNImage
                    source={
                      typeof catalog.imageSource === 'number'
                        ? catalog.imageSource
                        : { uri: catalog.imageSource }
                    }
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                </View>
              </PopSurface>
              <PopButton label="Close" tone="grape" onPress={() => setOverlay('none')} />
            </View>
          </PopSheet>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ToolButton({
  icon,
  label,
  onPress,
  disabled,
  active,
  badge,
}: {
  icon: PopIconName;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  active?: boolean;
  /** Live count shown as a small corner badge, e.g. the hint balance. */
  badge?: number;
}) {
  const tint = disabled ? colors.inkMuted : active ? colors.tangerine : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge != null ? `${label}, ${badge} available` : label}
      accessibilityState={{ selected: active, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[styles.tool, disabled && styles.toolDisabled]}
    >
      <View style={styles.toolIconWrap}>
        <PopIcon name={icon} size={24} color={tint} />
        {badge != null ? (
          <View style={styles.toolBadge}>
            <Text style={styles.toolBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.toolLabel, active && { color: colors.tangerine }]}>{label}</Text>
    </Pressable>
  );
}

// Kept exported for any caller still importing the old prop shape.
export function isPlayableGridSize(value: number): value is GridSize {
  return isSupportedGridSize(value);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  safeArea: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  bigTitle: { ...typography.title, color: colors.ink },
  meta: { ...typography.body, color: colors.inkMuted, textAlign: 'center' },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { ...typography.heading, color: colors.ink },
  headerMeta: { ...typography.caption, color: colors.inkMuted },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  clockInner: { paddingHorizontal: spacing.md, paddingVertical: 6 },
  clock: { ...typography.bodyStrong, color: colors.ink },
  boardShell: {
    flex: 1,
    minHeight: 220,
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: border.standard,
    borderColor: colors.ink,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  tool: { alignItems: 'center', gap: 3, paddingHorizontal: spacing.sm },
  toolDisabled: { opacity: 0.45 },
  toolIconWrap: { position: 'relative' },
  toolBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cherry,
    borderWidth: border.thin,
    borderColor: colors.ink,
  },
  toolBadgeText: { ...typography.caption, fontSize: 10, lineHeight: 12, color: colors.onFill },
  toolLabel: { ...typography.caption, fontSize: 11, color: colors.ink },
  sheetBody: { gap: spacing.md },
  pauseRows: { gap: spacing.sm },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  settingLabel: { ...typography.heading, fontSize: 18, color: colors.ink },
  hintHero: { alignItems: 'center', paddingVertical: spacing.sm },
  hintBalance: { ...typography.bodyStrong, color: colors.inkMuted, textAlign: 'center' },
  hintOutText: { ...typography.caption, color: colors.inkMuted, textAlign: 'center' },
  previewFrame: { padding: spacing.xs },
  previewImageWrap: {
    height: 240,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  previewImage: { width: '100%', height: '100%' },
});
