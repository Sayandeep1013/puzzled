import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Image as RNImage, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  coinsForCompletion,
  getCompletionsRepository,
  getProgressRepository,
  getPuzzleById,
  getSettingsRepository,
  getWalletRepository,
  resolvePuzzleImageSource,
  sessionStorageKey,
} from '@/data';
import {
  cellSizeForGrid,
  countLockedPieces,
  createPlayablePuzzle,
  createSeededRng,
  dropPiece,
  expectedPieceCount,
  findGeometry,
  isSessionRestorable,
  isSupportedGridSize,
  type GameSession,
  type GridSize,
  type PieceState,
  type PlayablePuzzle,
  type PuzzleDefinition,
} from '@/game-engine';
import { radii, shadow, spacing, typography } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';
import { createThemedStyles } from '@/shared/themed-styles';
import { type ArtName } from '@/shared/art';
import { Art, PopButton, PopSheet, PopSurface, PopToggle, Text } from '@/shared/ui';

import { setMusicEnabled, setSfxEnabled } from './board-audio';
import { FX, setHapticsEnabled } from './board-fx';
import { formatClock } from './play-clock';
import { BOARD_TRAY_RESERVE, PuzzleBoard } from './puzzle-board';
import { usePlayClock } from './use-play-clock';

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
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogState>({ status: 'loading' });
  const [gridSize, setGridSize] = useState<GridSize | null>(initialGridSize ?? null);
  const [playable, setPlayable] = useState<PlayablePuzzle | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  /** Bumped on reset to force a fresh board with a freshly measured world. */
  const [generation, setGeneration] = useState(0);
  const [overlay, setOverlay] = useState<OverlayKind>('none');
  const [sound, setSound] = useState(true);
  const [music, setMusic] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [highlightEdges, setHighlightEdges] = useState(false);
  /** Measured width of the board shell, used to cap its height. */
  const [shellWidth, setShellWidth] = useState(0);

  /**
   * Whether this screen is the one on top of the stack.
   *
   * The play clock must stop when it is not — pushing the Shop from the hint
   * sheet, or Results after the last piece, leaves this screen mounted and
   * otherwise still counting.
   */
  const [focused, setFocused] = useState(true);

  /**
   * Read by the focus callback below without being in its dependencies.
   *
   * `useFocusEffect` re-subscribes whenever its callback changes identity, so
   * depending on `complete`/`onReset` directly would make it re-run on ordinary
   * re-renders instead of only on a focus transition — which is the one thing it
   * must be keyed on.
   */
  const onFocusReturn = useRef<() => void>(() => {});

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      onFocusReturn.current();
      return () => setFocused(false);
    }, []),
  );

  const complete = session?.status === 'completed';

  /**
   * The one play clock.
   *
   * Time accrues only while there is a board, it is unfinished, this screen is
   * on top, and the pause sheet is closed — plus, inside the hook, only while
   * the app is foregrounded. Both of the clocks this replaces got some part of
   * that wrong: the visible one restarted from zero on every mount, and the
   * persisted one counted pauses, sheets and background time alike.
   */
  const running = playable != null && !complete && focused && overlay !== 'pause';
  const {
    active: clockRunning,
    elapsedMs,
    getElapsedMs,
    reset: resetClock,
  } = usePlayClock(running);

  // Debounced write-behind: dragging produces a session object per drop.
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The newest session worth writing. Never cleared — a write is an upsert. */
  const latestSession = useRef<GameSession | null>(null);

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
        // A *completed* session is never restored onto the board. Restoring one put
        // the player straight back on a solved puzzle, and because the completion
        // effect fires on `session.status === 'completed'`, it immediately handed off
        // to the results screen again — so "Play Again" bounced results → game →
        // results and the puzzle could not be replayed at all. Every other entry
        // point into a finished puzzle (Puzzles' "Again", a pack's or Daily's "Play
        // again") went through this same restore and was equally stuck.
        //
        // This is also what made the re-credit hazard reachable: a restored completed
        // session re-ran the completion effect on a fresh mount, where the
        // `handedOff` ref could not prevent it.
        if (saved && isSessionRestorable(saved, built.generated.puzzle, built.generated.pieces)) {
          restored = saved;
        }
      } catch {
        // A progress read failure must not block play; fall back to a new board.
      }

      if (!active) return;
      // Drop any write still owed by the board being replaced: it belongs to the
      // previous puzzle/size, and persisting it after this point would stamp the
      // new board's clock onto the old board's row.
      latestSession.current = null;
      setPlayable(built);
      setSession(restored ?? built.session);
      // Resume the clock where the saved session left it. This is the half that
      // made the timer look like it "just reset": the board came back
      // half-finished while the clock came back at 00:00.
      resetClock(restored?.elapsedMs ?? 0);
    })();

    return () => {
      active = false;
    };
  }, [catalog, gridSize, resetClock]);

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

  /**
   * Write the board's state, stamped with the play clock as it stands *now*.
   *
   * Elapsed time is stamped here rather than kept in `session` state on purpose.
   * It used to reach storage only as a side effect of placing a piece, so a long
   * think — or a pause, or walking away — was simply not recorded: the row still
   * held whatever the clock read at the last placement. Stamping at write time
   * makes every write carry the real figure without a render per second.
   */
  const persist = useCallback(() => {
    const pending = latestSession.current;
    if (!pending) {
      return;
    }
    const stamped: GameSession = {
      ...pending,
      elapsedMs: getElapsedMs(),
      updatedAt: new Date().toISOString(),
    };
    latestSession.current = stamped;
    void (async () => {
      try {
        await (await getProgressRepository()).saveSession(stamped);
      } catch {
        // Progress is best-effort; a failed write should never interrupt play.
      }
    })();
  }, [getElapsedMs]);

  useEffect(() => {
    if (!session || session.status === 'not-started') {
      return;
    }

    latestSession.current = session;
    if (pendingSave.current) {
      clearTimeout(pendingSave.current);
    }
    pendingSave.current = setTimeout(persist, 400);

    return () => {
      if (pendingSave.current) {
        clearTimeout(pendingSave.current);
      }
    };
  }, [session, persist]);

  /**
   * Write once more whenever the clock stops — paused, backgrounded, or this
   * screen pushed under another — and once on the way out.
   *
   * Keyed on the clock's own `active`, not on `running`: `running` says nothing
   * about the app being foregrounded, so keying on it meant backgrounding
   * stopped the clock without banking it, and anything since the last placement
   * was lost when the app was swiped away. Caught on device — a board run to
   * 01:07 came back at 00:20.
   *
   * The debounce above cancels its pending timer on cleanup, so leaving the
   * board inside the 400ms window used to discard that write entirely: place the
   * last piece you have time for, hit back, and it was never saved. These are
   * the only writes that are not debounced.
   */
  useEffect(() => {
    if (clockRunning) {
      return;
    }
    persist();
  }, [clockRunning, persist]);

  useEffect(() => persist, [persist]);

  // On completion, hand off to the results screen once — but only after a short
  // beat so the board's celebration (confetti + success haptic) is actually seen.
  // `handedOff` prevents a same-mount double navigation/credit (e.g. a spurious
  // re-render while `complete` is still true). It is a per-mount ref, so it could
  // not have stopped a re-credit across "Play Again" — but that path is now closed
  // at the source: a completed session is never restored onto the board, so a fresh
  // mount always starts from an unfinished one and this effect cannot re-fire. The
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
    // Read once, here: by the time the hand-off timer fires the clock has
    // already stopped (`complete` clears `running`), and Results must show the
    // same figure Statistics will.
    const elapsedAtCompletion = getElapsedMs();

    void (async () => {
      try {
        // Recorded before the coin credit, and separately from the session row:
        // the session is overwritten the moment this board is replayed, so it
        // cannot be the record of having finished it. Unlike the credit this is
        // *not* deduped — finishing the same puzzle twice is two completions.
        await (
          await getCompletionsRepository()
        ).record({
          puzzleId: completedPuzzleId,
          gridSize,
          elapsedMs: elapsedAtCompletion,
          completedAt: new Date().toISOString(),
        });
      } catch {
        // Best-effort: a failed write must not block the trip to results.
      }

      try {
        await (
          await getWalletRepository()
        ).recordOnce({
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
          timeMs: String(elapsedAtCompletion),
          coins: String(earnedCoins),
        },
      });
    }, FX.celebrateMs);
    return () => clearTimeout(timer);
  }, [complete, catalog, gridSize, getElapsedMs, router]);

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
    // The saved row is about to be deleted; without this the unmount flush would
    // write the old session straight back and undo the restart.
    latestSession.current = null;

    const fresh = buildPlayable(catalog.puzzle, gridSize);
    setPlayable(fresh);
    setSession(fresh.session);
    setGeneration((value) => value + 1);
    resetClock(0);
    handedOff.current = false;

    void (async () => {
      try {
        await (await getProgressRepository()).deleteSession(catalog.puzzle.id, gridSize);
      } catch {
        // Local board is already reset; a stale row is overwritten on the next save.
      }
    })();
  }, [catalog, gridSize, resetClock]);

  /**
   * Returning to a finished board starts it over.
   *
   * Results' "Play Again" dismisses back to this screen rather than pushing a
   * second copy of it (see `results-screen.tsx`), so the board it lands on is the
   * one that was just solved. Without this the player arrives at a completed
   * puzzle with nothing left to place.
   *
   * It hangs off the focus transition rather than off `complete` because the
   * board stays focused for `FX.celebrateMs` after the last piece lands —
   * resetting on `complete` alone would wipe the confetti that delay exists to
   * show.
   */
  useEffect(() => {
    onFocusReturn.current = () => {
      if (complete) {
        onReset();
      }
    };
  }, [complete, onReset]);

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

  /**
   * "Show me one": locks a random unplaced piece at its solved position, via the
   * engine's own `dropPiece` (position === solvedPosition with a zero threshold
   * always snaps and locks).
   *
   * Free, and synchronous because of it. This used to debit a hint from the
   * wallet first, which made it an async debit-then-place and needed a
   * re-entrancy guard: the `disabled` prop and the balance check both read the
   * same closured `wallet`, which only updated once the debit resolved, so two
   * fast taps could both pass and place two pieces for one hint. With nothing to
   * spend there is nothing to race, and the guard goes with the debit.
   */
  const onSpendHint = useCallback(() => {
    if (!session || !playable) {
      return;
    }
    const unplaced = session.pieces.filter((piece) => !piece.isLocked);
    if (unplaced.length === 0) {
      setOverlay('none');
      return;
    }

    const target = unplaced[Math.floor(Math.random() * unplaced.length)];
    const geometry = findGeometry(playable.generated.pieces, target.pieceId);
    onSessionChange(
      dropPiece({
        session,
        pieceId: target.pieceId,
        position: geometry.solvedPosition,
        solvedPosition: geometry.solvedPosition,
        now: new Date().toISOString(),
        // The live clock, not `session.elapsedMs` — that field is only refreshed
        // when the board writes, so reusing it here would roll the play time back
        // to whatever it read at the last placement.
        elapsedMs: getElapsedMs(),
        snapThreshold: 0,
      }),
    );
    setOverlay('none');
  }, [session, playable, getElapsedMs, onSessionChange]);

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
  const trayCount = session.pieces.filter((piece) =>
    isTrayPiece(piece, generated.boardSize.height),
  ).length;

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
              style={styles.roundButton}
            >
              <Art name="back" size={26} />
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
              <PopSurface
                fill={theme.colors.surface}
                radius={radii.pill}
                contentStyle={styles.clockInner}
              >
                <Art name="clock" size={20} />
                <Text style={styles.clock}>{formatClock(elapsedMs)}</Text>
              </PopSurface>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pause"
                hitSlop={10}
                onPress={() => setOverlay('pause')}
                style={styles.roundButton}
              >
                <Art name="pause" size={26} />
              </Pressable>
            </View>
          </View>

          {/* The board is square, so a shell taller than its own width plus the
              tray can only add dead cream margin — which is exactly what the
              wide gap above and below the board was. Measuring the width and
              capping the height removes it without guessing an aspect ratio. */}
          <View
            style={[
              styles.boardShell,
              shellWidth > 0 && { maxHeight: shellWidth + BOARD_TRAY_RESERVE },
            ]}
            onLayout={(event) => {
              const { width } = event.nativeEvent.layout;
              setShellWidth((current) => (Math.abs(current - width) < 1 ? current : width));
            }}
          >
            <PuzzleBoard
              key={`${generated.puzzle.id}:${generated.puzzle.revision}:${gridSize}:${generation}`}
              generated={generated}
              session={session}
              imageSource={catalog.imageSource}
              onSessionChange={onSessionChange}
              getElapsedMs={getElapsedMs}
              highlightEdges={highlightEdges}
            />
          </View>

          {/* Order matches the mockup's toolbar: Hint, Edges, Preview, Shuffle. */}
          <View style={styles.toolbar}>
            <ToolButton art="bulb" label="Hint" onPress={() => setOverlay('hint')} />
            <ToolButton
              art="edges"
              label="Edges"
              active={highlightEdges}
              onPress={() => setHighlightEdges((on) => !on)}
            />
            <ToolButton art="eye" label="Preview" onPress={() => setOverlay('preview')} />
            <ToolButton
              art="shuffle"
              label="Shuffle"
              disabled={trayCount < 2}
              onPress={onShuffleTray}
            />
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
                  <PopToggle
                    value={haptics}
                    onChange={onToggleHaptics}
                    accessibilityLabel="Haptics"
                  />
                </SettingRow>
              </View>
              <PopButton
                label="Resume"
                tone="grass"
                icon={<Art name="resume" size={24} />}
                onPress={() => setOverlay('none')}
              />
              <PopButton
                label="Restart"
                tone="honey"
                icon={<Art name="restart" size={24} />}
                onPress={() => {
                  setOverlay('none');
                  onReset();
                }}
              />
              <PopButton
                label="Exit Puzzle"
                tone="surface"
                icon={<Art name="quit-home" size={24} />}
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
                <Art name="reveal-piece" size={84} />
              </View>
              <Text style={styles.hintBalance}>Stuck? Put one piece in for me.</Text>
              <PopButton label="Show me one" tone="grass" onPress={onSpendHint} />
              <PopButton
                label={highlightEdges ? 'Hide edges' : 'Highlight edges'}
                tone="sky"
                onPress={() => {
                  setHighlightEdges((on) => !on);
                  setOverlay('none');
                }}
              />
              <PopButton label="Preview image" tone="honey" onPress={() => setOverlay('preview')} />
            </View>
          </PopSheet>
        ) : null}

        {overlay === 'preview' ? (
          <PopSheet title="Preview" onDismiss={() => setOverlay('none')}>
            <View style={styles.sheetBody}>
              <PopSurface
                fill={theme.colors.honey}
                radius={radii.md}
                contentStyle={styles.previewFrame}
              >
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
              <PopButton label="Close" tone="grass" onPress={() => setOverlay('none')} />
            </View>
          </PopSheet>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ToolButton({
  art,
  label,
  onPress,
  disabled,
  active,
  badge,
}: {
  art: ArtName;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  active?: boolean;
  /** Live count shown as a small corner badge, e.g. the hint balance. */
  badge?: number;
}) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge != null ? `${label}, ${badge} available` : label}
      accessibilityState={{ selected: active, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={styles.tool}
    >
      <PopSurface
        fill={active ? theme.colors.honey : theme.colors.surface}
        radius={radii.md}
        elevation={disabled ? 'pressed' : 'card'}
        contentStyle={styles.toolInner}
      >
        <View style={styles.toolIconWrap}>
          {/* The art is full-colour, so disabled and active states come from the
              surface and opacity rather than from tinting the glyph. */}
          <Art name={art} size={28} style={disabled ? styles.toolArtDisabled : undefined} />
          {badge != null ? (
            <View style={styles.toolBadge}>
              <Text style={styles.toolBadgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={[styles.toolLabel, disabled && styles.toolLabelDisabled]}>
          {label}
        </Text>
      </PopSurface>
    </Pressable>
  );
}

// Kept exported for any caller still importing the old prop shape.
export function isPlayableGridSize(value: number): value is GridSize {
  return isSupportedGridSize(value);
}

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.backgrounds.game },
    safeArea: { flex: 1 },
    // The back and pause art are bare glyphs with no ground of their own, so they
    // need a surface behind them to read against the board's pale green.
    roundButton: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.pill,
      backgroundColor: theme.colors.surface,
      boxShadow: shadow.card,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.lg,
    },
    bigTitle: { ...typography.title, color: theme.colors.ink },
    meta: { ...typography.body, color: theme.colors.inkMuted, textAlign: 'center' },
    content: {
      flex: 1,
      width: '100%',
      maxWidth: 900,
      alignSelf: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      // Wider than spacing.sm: the header, board and toolbar previously sat almost
      // flush, so the three read as one crowded block.
      gap: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingHorizontal: spacing.sm,
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { ...typography.heading, color: theme.colors.headingGreen },
    headerMeta: { ...typography.caption, color: theme.colors.inkMuted },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    clockInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    clock: { ...typography.heading, fontSize: 17, color: theme.colors.ink },
    // A cream tray under the board, matching the mockup: the board area is a
    // card, not an outlined box.
    boardShell: {
      flex: 1,
      minHeight: 220,
      overflow: 'hidden',
      borderRadius: radii.lg,
      backgroundColor: theme.colors.surface,
      boxShadow: shadow.card,
      /**
       * Absorbs the leftover column height above the board rather than below the
       * toolbar.
       *
       * `maxHeight` caps how far `flex: 1` can grow (the board is square, so a taller
       * shell is only dead margin), and the slack that cap leaves used to collect
       * after the last child — stranding the toolbar in mid-screen with empty space
       * beneath it. An auto top margin claims that slack instead, which drops the
       * board/tray/toolbar block down the screen and seats the toolbar on the bottom
       * edge in one move.
       */
      marginTop: 'auto',
    },
    toolbar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'stretch',
      gap: spacing.sm,
      // No vertical padding of its own: `content`'s gap sets the space above and the
      // safe-area inset sets the space below, so the row sits on the bottom edge.
      paddingVertical: 0,
    },
    tool: { flex: 1 },
    toolInner: { alignItems: 'center', gap: 3, paddingVertical: spacing.sm },
    toolIconWrap: { position: 'relative' },
    toolArtDisabled: { opacity: 0.4 },
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
      backgroundColor: theme.colors.apricot,
    },
    toolBadgeText: {
      ...typography.caption,
      fontSize: 10,
      lineHeight: 12,
      color: theme.colors.onFill,
    },
    // See `PopButton`'s label: two points of measurement slack, not spacing.
    toolLabel: {
      ...typography.caption,
      fontSize: 11,
      color: theme.colors.ink,
      paddingHorizontal: 2,
    },
    toolLabelDisabled: { color: theme.colors.inkMuted },
    sheetBody: { gap: spacing.md },
    pauseRows: { gap: spacing.sm },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs,
    },
    settingLabel: { ...typography.heading, fontSize: 18, color: theme.colors.ink },
    hintHero: { alignItems: 'center', paddingVertical: spacing.sm },
    hintBalance: { ...typography.bodyStrong, color: theme.colors.inkMuted, textAlign: 'center' },
    previewFrame: { padding: spacing.xs },
    previewImageWrap: {
      height: 240,
      borderRadius: radii.md,
      overflow: 'hidden',
    },
    previewImage: { width: '100%', height: '100%' },
  }),
);
