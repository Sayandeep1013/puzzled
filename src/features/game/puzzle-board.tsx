/* eslint-disable react-hooks/immutability, react-hooks/refs, react-hooks/purity --
 * Reanimated shared values and gesture handlers intentionally mutate `.value` and close over refs.
 */
import {
  Canvas,
  Circle,
  Group,
  Image,
  Line,
  Path,
  Rect,
  rect,
  RoundedRect,
  useImage,
  vec,
  type SkImage,
  type SkPath,
} from '@shopify/react-native-skia';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { getSettingsRepository } from '@/data';
import {
  dropPiece,
  isWithinSnapDistance,
  makePieceId,
  raisePiece,
  snapThresholdForCellSize,
  TAB_SIZE_RATIO,
  type GameSession,
  type GeneratedPuzzle,
  type PieceEdges,
  type PieceGeometry,
  type PieceLocalPath,
  type PieceState,
  type Point,
  type Size,
} from '@/game-engine';
import { commandsToSkPath } from '@/game-engine/rendering';
import { colors } from '@/shared/theme';

import { initBoardAudio, pauseBoardAudio, playSfx } from './board-audio';
import { FX, impact, setHapticsEnabled, success } from './board-fx';
import { useBoardCamera } from './use-board-camera';

const BOARD_PADDING = 12;
const TRAY_HEIGHT = 132;
const TRAY_PAD = 12;
const SLOT_GAP = 6;
const CONFETTI_COLORS = [colors.berry, colors.honey, colors.apricot, colors.grass, colors.blossom];
/** Pointer velocity (px/s) that maps to the full `FX.maxTiltDeg` tilt while dragging. */
const TILT_VELOCITY_RANGE = 900;

interface PuzzleBoardProps {
  generated: GeneratedPuzzle;
  session: GameSession;
  /** Bundled `require` module id, or a `file://` uri for an imported photo. */
  imageSource: number | string;
  onSessionChange: (session: GameSession) => void;
  /** When true, unplaced border pieces are outlined in the tray (edges-first helper). */
  highlightEdges?: boolean;
}

interface PreparedPiece {
  geometry: PieceGeometry;
  localPath: PieceLocalPath;
  skPath: SkPath;
  isEdge: boolean;
  /** Centre of the piece's silhouette in local (piece) space. */
  cx: number;
  cy: number;
}

function isEdgePiece(edges: PieceEdges): boolean {
  return edges.top === 0 || edges.right === 0 || edges.bottom === 0 || edges.left === 0;
}

/** Clip the shared source image to a piece silhouette. Scale-agnostic (parent Group scales). */
function PieceFill({
  prepared,
  image,
  imageScale,
}: {
  prepared: PreparedPiece;
  image: SkImage;
  imageScale: number;
}) {
  const { geometry, skPath } = prepared;
  return (
    <Group clip={skPath}>
      <Image
        image={image}
        x={-geometry.sourceRect.x * imageScale}
        y={-geometry.sourceRect.y * imageScale}
        width={image.width() * imageScale}
        height={image.height() * imageScale}
      />
    </Group>
  );
}

/** A piece locked into the board at its solved position. */
const BoardPiece = memo(function BoardPiece({
  prepared,
  image,
  imageScale,
}: {
  prepared: PreparedPiece;
  image: SkImage;
  imageScale: number;
}) {
  const { solvedPosition } = prepared.geometry;
  return (
    <Group transform={[{ translateX: solvedPosition.x }, { translateY: solvedPosition.y }]}>
      <PieceFill prepared={prepared} image={image} imageScale={imageScale} />
      <Path path={prepared.skPath} style="stroke" strokeWidth={1} color="rgba(23,33,33,0.12)" />
    </Group>
  );
});

/**
 * A locked piece mid-wobble: one of the just-placed piece's orthogonal
 * neighbours, briefly rendered through its own shared value instead of
 * `BoardPiece`'s static transform. Unmounts itself back to `BoardPiece` via
 * `onDone` once the wobble finishes, so no locked piece carries an animated
 * transform permanently (perf: only the handful of affected neighbours ever
 * mount this, and only for `FX.jiggleMs`).
 */
function JigglingBoardPiece({
  prepared,
  image,
  imageScale,
  onDone,
}: {
  prepared: PreparedPiece;
  image: SkImage;
  imageScale: number;
  onDone: () => void;
}) {
  const offset = useSharedValue(0);
  // `onDone` is a fresh inline closure on every parent render (it's created
  // inside a `.map()`); route it through a ref so the animation effect below
  // depends only on `offset` and fires exactly once per mount instead of
  // restarting the wobble if the board happens to re-render mid-jiggle.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const half = FX.jiggleMs / 2;
    const finish = () => onDoneRef.current();
    offset.value = withSequence(
      withTiming(-FX.jiggleAmplitude, { duration: half * 0.5, easing: Easing.out(Easing.quad) }),
      withTiming(FX.jiggleAmplitude, { duration: half }),
      withTiming(0, { duration: half * 0.5 }, (finished) => {
        if (finished) {
          runOnJS(finish)();
        }
      }),
    );
  }, [offset]);

  const { solvedPosition } = prepared.geometry;
  const transform = useDerivedValue(() => [
    { translateX: solvedPosition.x },
    { translateY: solvedPosition.y + offset.value },
  ]);

  return (
    <Group transform={transform}>
      <PieceFill prepared={prepared} image={image} imageScale={imageScale} />
      <Path path={prepared.skPath} style="stroke" strokeWidth={1} color="rgba(23,33,33,0.12)" />
    </Group>
  );
}

/**
 * An unplaced piece resting directly on the board — a miss that stayed where it
 * landed instead of returning to the tray. Same silhouette as `BoardPiece`, but
 * outlined with the tray's accent stroke to read as unlocked.
 */
const LoosePiece = memo(function LoosePiece({
  prepared,
  image,
  imageScale,
  position,
  hidden,
}: {
  prepared: PreparedPiece;
  image: SkImage;
  imageScale: number;
  position: Point;
  hidden: boolean;
}) {
  if (hidden) {
    return null;
  }
  return (
    <Group transform={[{ translateX: position.x }, { translateY: position.y }]}>
      <PieceFill prepared={prepared} image={image} imageScale={imageScale} />
      <Path path={prepared.skPath} style="stroke" strokeWidth={2} color={colors.apricot} />
    </Group>
  );
});

/** One unplaced piece sitting in a tray slot, centred and scaled to the thumbnail size. */
const TrayPiece = memo(function TrayPiece({
  prepared,
  image,
  imageScale,
  slotCenterX,
  slotCenterY,
  scale,
  highlight,
  hidden,
}: {
  prepared: PreparedPiece;
  image: SkImage;
  imageScale: number;
  slotCenterX: number;
  slotCenterY: number;
  scale: number;
  highlight: boolean;
  hidden: boolean;
}) {
  if (hidden) {
    return null;
  }
  return (
    <Group
      transform={[
        { translateX: slotCenterX },
        { translateY: slotCenterY },
        { scale },
        { translateX: -prepared.cx },
        { translateY: -prepared.cy },
      ]}
    >
      <PieceFill prepared={prepared} image={image} imageScale={imageScale} />
      <Path
        path={prepared.skPath}
        style="stroke"
        strokeWidth={highlight ? 3 : 1.6}
        color={highlight ? colors.apricot : 'rgba(23,33,33,0.28)'}
      />
    </Group>
  );
});

/**
 * The piece under the finger, drawn at board scale and tracking the finger
 * exactly. `fx`/`fy` are raw canvas coordinates (the piece is rendered outside
 * the camera-transformed board group so it never gets double-transformed),
 * but its drawn *size* still follows the live camera zoom so it matches the
 * board underneath if a second finger pinches mid-drag.
 */
function FloatingPiece({
  prepared,
  image,
  imageScale,
  boardScale,
  camScale,
  fx,
  fy,
  tiltDeg,
  scaleBoost,
}: {
  prepared: PreparedPiece;
  image: SkImage;
  imageScale: number;
  boardScale: number;
  camScale: SharedValue<number>;
  fx: SharedValue<number>;
  fy: SharedValue<number>;
  /** Live drag tilt in degrees, capped at `FX.maxTiltDeg`; springs back to 0 on release. */
  tiltDeg: SharedValue<number>;
  /** `FX.liftScale` while held, springing to 1 (`FX.settle`) once released. */
  scaleBoost: SharedValue<number>;
}) {
  const transform = useDerivedValue(() => [
    { translateX: fx.value },
    { translateY: fy.value },
    { rotate: (tiltDeg.value * Math.PI) / 180 },
    { scale: boardScale * camScale.value * scaleBoost.value },
    { translateX: -prepared.cx },
    { translateY: -prepared.cy },
  ]);

  return (
    <Group transform={transform}>
      <PieceFill prepared={prepared} image={image} imageScale={imageScale} />
      <Path path={prepared.skPath} style="stroke" strokeWidth={2.4} color="rgba(232,110,69,0.95)" />
    </Group>
  );
}

/** A one-shot ring that pops outward when a piece locks home (canvas coords). */
function GlowRing({
  id,
  cx,
  cy,
  onDone,
}: {
  id: number;
  cx: number;
  cy: number;
  onDone: (id: number) => void;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }, (done) => {
      if (done) {
        runOnJS(onDone)(id);
      }
    });
  }, [progress, id, onDone]);
  const radius = useDerivedValue(() => 10 + progress.value * 40);
  const opacity = useDerivedValue(() => (1 - progress.value) * 0.85);
  return (
    <Circle
      cx={cx}
      cy={cy}
      r={radius}
      style="stroke"
      strokeWidth={3}
      color={colors.apricot}
      opacity={opacity}
    />
  );
}

interface Particle {
  i: number;
  startX: number;
  startY: number;
  delay: number;
  drift: number;
  spin: number;
  size: number;
  color: string;
}

function ConfettiPiece({
  particle,
  t,
  height,
}: {
  particle: Particle;
  t: SharedValue<number>;
  height: number;
}) {
  const transform = useDerivedValue(() => {
    const span = 1 - particle.delay;
    const tt = Math.min(1, Math.max(0, (t.value - particle.delay) / span));
    const y = particle.startY + tt * (height + 80);
    const x = particle.startX + Math.sin(tt * 6 + particle.i) * particle.drift;
    return [{ translateX: x }, { translateY: y }, { rotate: tt * particle.spin }];
  });
  const opacity = useDerivedValue(() =>
    t.value < 0.85 ? 1 : Math.max(0, 1 - (t.value - 0.85) / 0.15),
  );
  return (
    <Group transform={transform} opacity={opacity}>
      <RoundedRect
        x={0}
        y={0}
        width={particle.size}
        height={particle.size * 0.5}
        r={1.5}
        color={particle.color}
      />
    </Group>
  );
}

function Confetti({ width, height }: { width: number; height: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) });
  }, [t]);
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: FX.confettiCount }, (_, i) => ({
        i,
        startX: Math.random() * width,
        startY: -20 - Math.random() * height * 0.3,
        delay: Math.random() * 0.35,
        drift: 20 + Math.random() * 40,
        spin: (Math.random() * 8 - 4) * Math.PI,
        size: 8 + Math.random() * 6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [width, height],
  );
  return (
    <Canvas style={[styles.overlay, { width, height }]} pointerEvents="none">
      {particles.map((p) => (
        <ConfettiPiece key={p.i} particle={p} t={t} height={height} />
      ))}
    </Canvas>
  );
}

export function PuzzleBoard({
  generated,
  session,
  imageSource,
  onSessionChange,
  highlightEdges = false,
}: PuzzleBoardProps) {
  const image = useImage(imageSource);
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const [startedAtMs] = useState(() => Date.now());
  const [baselineElapsedMs] = useState(() => session.elapsedMs);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [snapFlash, setSnapFlash] = useState<{ id: number; cx: number; cy: number } | null>(null);
  /** pieceId → wobble token for locked neighbours currently jiggling (Task 13). */
  const [jiggleTokens, setJiggleTokens] = useState<Record<string, number>>({});

  // Finger position of the floating piece, in canvas coordinates.
  const fx = useSharedValue(0);
  const fy = useSharedValue(0);
  /** Live drag tilt in degrees (`FX.maxTiltDeg` cap); springs to 0 on release. */
  const tiltDeg = useSharedValue(0);
  /** `FX.liftScale` while held; springs to 1 via `FX.settle` on release. */
  const scaleBoost = useSharedValue<number>(FX.liftScale);
  const trayScroll = useSharedValue(0);
  /**
   * 0 idle · 1 dragging a piece · 2 scrolling the tray · 3 panning the
   * camera (a one-finger touch on empty board space). Decided instantly in
   * onBegin: a finger starting on a piece grabs it, on empty board space it
   * pans the camera, on the tray it scrolls (or grabs a tray piece).
   */
  const mode = useSharedValue(0);
  /** Index into the current tray render order, or -1 when the grab isn't from the tray. */
  const grabSlot = useSharedValue(-1);
  /** Index into `looseHitTestData`/`looseIdsRef`, or -1 when the grab isn't a loose piece. */
  const grabLoose = useSharedValue(-1);
  const flashId = useRef(0);

  const sessionRef = useRef(session);
  const onSessionChangeRef = useRef(onSessionChange);
  const trayIdsRef = useRef<string[]>([]);
  const looseIdsRef = useRef<string[]>([]);
  const celebratedRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    onSessionChangeRef.current = onSessionChange;
  }, [onSessionChange]);

  // Read the persisted Sound/Music/Haptics settings once per mount and wire
  // them into the board-fx/board-audio modules. The pause-menu toggles
  // (Task 14) call `setHapticsEnabled`/`setSfxEnabled`/`setMusicEnabled`
  // directly from then on; this effect only supplies the starting values.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const settings = await (await getSettingsRepository()).get();
        if (!active) {
          return;
        }
        setHapticsEnabled(settings.haptics);
        await initBoardAudio(settings);
        if (!active) {
          // Unmounted while init was in flight (e.g. `ensurePlayersLoaded()`
          // was still pending): the cleanup's `pauseBoardAudio()` ran before
          // the ambient player existed and no-opped. Players are guaranteed
          // to exist now, so pause again to stop a loop `applyMusicState()`
          // may have just started.
          pauseBoardAudio();
        }
      } catch {
        // Settings/audio are best-effort; the board must stay playable
        // even if the read fails (defaults are already sound-on/haptics-on).
      }
    })();
    return () => {
      active = false;
      // Leaving the board shouldn't leave the ambient loop playing forever.
      pauseBoardAudio();
    };
  }, []);

  const cellSize = generated.cellSize.width;
  const boardSize = generated.boardSize;
  const imageScale = boardSize.width / generated.crop.width;
  const snapThreshold = snapThresholdForCellSize(cellSize);
  const gridSize = generated.puzzle.gridSize;

  const preparedById = useMemo(() => {
    const map: Record<string, PreparedPiece> = {};
    for (const geometry of generated.pieces) {
      const localPath = generated.paths[geometry.id];
      const b = localPath.bounds;
      map[geometry.id] = {
        geometry,
        localPath,
        skPath: commandsToSkPath(localPath.commands),
        isEdge: isEdgePiece(geometry.edges),
        cx: b.x + b.width / 2,
        cy: b.y + b.height / 2,
      };
    }
    return map;
  }, [generated]);

  // Locked pieces live on the board at their solved position; unlocked pieces are
  // either loose on the board (a miss that stayed put) or waiting in the tray.
  const lockedPieces = useMemo(() => session.pieces.filter((p) => p.isLocked), [session.pieces]);

  /**
   * The engine lays unplaced pieces out below the board (`layout.ts` tray rows),
   * so a y inside the board rect means the player has dropped this piece on the
   * board and it should stay there, re-grabbable, instead of returning to a slot.
   */
  const isOnBoard = useCallback(
    (piece: PieceState) => piece.position.y < boardSize.height,
    [boardSize.height],
  );

  // Loose pieces are sorted by z-index (ascending) so overlapping drops paint
  // and hit-test in the same order: the most recently touched piece is on top.
  const loosePieces = useMemo(
    () =>
      session.pieces.filter((p) => !p.isLocked && isOnBoard(p)).sort((a, b) => a.zIndex - b.zIndex),
    [session.pieces, isOnBoard],
  );

  const trayPieces = useMemo(
    () => session.pieces.filter((p) => !p.isLocked && !isOnBoard(p)),
    [session.pieces, isOnBoard],
  );

  const looseIds = useMemo(() => loosePieces.map((p) => p.pieceId), [loosePieces]);
  const trayIds = useMemo(() => trayPieces.map((p) => p.pieceId), [trayPieces]);
  useEffect(() => {
    looseIdsRef.current = looseIds;
  }, [looseIds]);
  useEffect(() => {
    trayIdsRef.current = trayIds;
  }, [trayIds]);

  // Hit-test boxes for loose board pieces, in the same board-local space as
  // `releasePiece`'s coordinate conversion (post BOARD_PADDING removal). Kept as
  // plain numbers/strings only — no SkPath/Skia objects — so the gesture worklet
  // can safely close over this array.
  const looseHitTestData = useMemo(
    () =>
      loosePieces.map((piece) => {
        const prepared = preparedById[piece.pieceId];
        const bounds = prepared.localPath.bounds;
        return {
          cx: piece.position.x + prepared.cx,
          cy: piece.position.y + prepared.cy,
          halfW: bounds.width / 2,
          halfH: bounds.height / 2,
        };
      }),
    [loosePieces, preparedById],
  );

  // ---- Layout: board zone (fits, edges visible) above a fixed tray strip. ----
  const layout = useMemo(() => {
    const vw = viewport.width;
    const vh = viewport.height;
    const boardZoneH = Math.max(vh - TRAY_HEIGHT, 1);
    const outerW = boardSize.width + BOARD_PADDING * 2;
    const outerH = boardSize.height + BOARD_PADDING * 2;
    // Fit the whole board (with margin) so every edge stays on screen.
    const boardScale = Math.min((vw * 0.96) / outerW, (boardZoneH * 0.94) / outerH);
    const boardOffsetX = (vw - outerW * boardScale) / 2;
    const boardOffsetY = (boardZoneH - outerH * boardScale) / 2;

    const slotInner = TRAY_HEIGHT - TRAY_PAD * 2;
    const pieceExtent = cellSize * (1 + 2 * TAB_SIZE_RATIO);
    const thumbScale = (slotInner * 0.88) / pieceExtent;
    const slotW = slotInner + SLOT_GAP;

    return {
      vw,
      vh,
      boardZoneH,
      boardScale,
      boardOffsetX,
      boardOffsetY,
      slotW,
      thumbScale,
      slotInner,
    };
  }, [viewport.width, viewport.height, boardSize.width, boardSize.height, cellSize]);

  // Camera pans/zooms the board zone only (1x-3x); the tray strip is pinned
  // and unscaled. At rest (scale 1, translate 0) it is the identity, so it
  // never perturbs the Task 11 static framing computed above.
  const camera = useBoardCamera({ viewport: { width: layout.vw, height: layout.boardZoneH } });
  const {
    scale: camScale,
    translateX: camTx,
    translateY: camTy,
    pinch: camPinch,
    doubleTap: camDoubleTap,
    panBy: camPanBy,
    ready: camReady,
  } = camera;

  const cameraTransform = useDerivedValue(() => [
    { translateX: camTx.value },
    { translateY: camTy.value },
    { scale: camScale.value },
  ]);

  const draggingPrepared = draggingId ? preparedById[draggingId] : null;

  const complete = session.status === 'completed';
  useEffect(() => {
    if (complete && !celebratedRef.current) {
      celebratedRef.current = true;
      success();
      playSfx('complete');
    }
  }, [complete]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport((cur) => (cur.width === width && cur.height === height ? cur : { width, height }));
  };

  const clearFlash = useCallback(
    (id: number) => setSnapFlash((cur) => (cur && cur.id === id ? null : cur)),
    [],
  );

  /** Resolve a grab/release origin (0 = tray slot, 1 = loose board piece) to a piece id. */
  const resolveGrabbedId = useCallback((source: 0 | 1, index: number) => {
    return source === 0 ? trayIdsRef.current[index] : looseIdsRef.current[index];
  }, []);

  const beginGrab = useCallback(
    (source: 0 | 1, index: number) => {
      const id = resolveGrabbedId(source, index);
      if (id) {
        setDraggingId(id);
        impact('light');
        playSfx('pickup');
      }
    },
    [resolveGrabbedId],
  );

  const clearDragging = useCallback(() => setDraggingId(null), []);

  /**
   * Bring the floating piece's scale/tilt back to identity via `FX.settle`
   * before finally clearing `draggingId` — the piece stays mounted (and the
   * real BoardPiece/LoosePiece it hands off to is already drawn underneath,
   * at the same spot) for the short settle window instead of popping away
   * the instant the finger lifts.
   */
  const settleFloatingPiece = useCallback(
    (targetX: number, targetY: number) => {
      fx.value = withSpring(targetX, FX.settle);
      fy.value = withSpring(targetY, FX.settle);
      tiltDeg.value = withSpring(0, FX.settle);
      // Gate clearing `draggingId` on the scale spring specifically: unlike
      // tilt (which may already be ~0 and resolve in a single frame), the
      // lift→1 travel is always a fixed, non-trivial distance, so this
      // reliably outlives the whole settle motion.
      scaleBoost.value = withSpring(1, FX.settle, (finished) => {
        if (finished) {
          runOnJS(clearDragging)();
        }
      });
    },
    [fx, fy, tiltDeg, scaleBoost, clearDragging],
  );

  const clearJiggle = useCallback((pieceId: string, token: number) => {
    setJiggleTokens((prev) => {
      if (prev[pieceId] !== token) {
        // A newer wobble has since started on the same neighbour; leave it running.
        return prev;
      }
      const next = { ...prev };
      delete next[pieceId];
      return next;
    });
  }, []);

  /** Orthogonal locked neighbours of `pieceId` (by row/column), for the lock-jiggle. */
  const triggerNeighbourJiggle = useCallback(
    (pieceId: string) => {
      const geometry = preparedById[pieceId]?.geometry;
      if (!geometry) {
        return;
      }
      const { row, column } = geometry;
      const candidates = [
        row > 0 ? makePieceId(row - 1, column) : null,
        row < gridSize - 1 ? makePieceId(row + 1, column) : null,
        column > 0 ? makePieceId(row, column - 1) : null,
        column < gridSize - 1 ? makePieceId(row, column + 1) : null,
      ].filter((id): id is string => id !== null);

      const lockedNeighbourIds = candidates.filter((id) =>
        sessionRef.current.pieces.some((p) => p.pieceId === id && p.isLocked),
      );
      if (lockedNeighbourIds.length === 0) {
        return;
      }

      setJiggleTokens((prev) => {
        const next = { ...prev };
        for (const id of lockedNeighbourIds) {
          next[id] = (next[id] ?? 0) + 1;
        }
        return next;
      });
    },
    [preparedById, gridSize],
  );

  const gesture = useMemo(() => {
    const { boardZoneH, boardScale, boardOffsetX, boardOffsetY, slotW, vw } = layout;
    const count = trayIds.length;
    const contentW = count * slotW + TRAY_PAD * 2;
    const minScroll = Math.min(0, vw - contentW);
    const looseBoxes = looseHitTestData;

    const releasePiece = (source: 0 | 1, index: number, canvasX: number, canvasY: number) => {
      const id = resolveGrabbedId(source, index);
      if (!id) {
        setDraggingId(null);
        return;
      }
      const prepared = preparedById[id];
      if (!prepared) {
        setDraggingId(null);
        return;
      }
      // Canvas → board piece-space. The board zone now renders behind the
      // camera transform, so this must undo the LIVE camera first (JS-thread
      // read of the camera's shared values — same pattern as the onBegin
      // worklet below, just off the UI thread) before the static framing
      // math from Task 11, which is otherwise unchanged.
      const preCamX = (canvasX - camTx.value) / camScale.value;
      const preCamY = (canvasY - camTy.value) / camScale.value;
      const boardX = (preCamX - boardOffsetX) / boardScale - BOARD_PADDING;
      const boardY = (preCamY - boardOffsetY) / boardScale - BOARD_PADDING;
      const position = { x: boardX - prepared.cx, y: boardY - prepared.cy };
      const solved = prepared.geometry.solvedPosition;

      const now = new Date().toISOString();
      const raised = raisePiece(sessionRef.current, id, now);
      const elapsedMs = baselineElapsedMs + (Date.now() - startedAtMs);
      const common = { session: raised, pieceId: id, solvedPosition: solved, now, elapsedMs };

      const placeThreshold = snapThreshold;
      if (!isWithinSnapDistance(position, solved, placeThreshold)) {
        // Out of range on the board: leave the piece exactly where it was released so
        // it can be nudged and re-grabbed. Released over the tray, it returns to the
        // tray instead (its position never changes, so it's simply back where it was).
        if (canvasY < boardZoneH) {
          onSessionChangeRef.current(dropPiece({ ...common, position, snapThreshold: 0 }));
          // The piece already rests exactly at (canvasX, canvasY) — only the
          // lift scale/tilt need to settle back to identity there.
          settleFloatingPiece(canvasX, canvasY);
        } else {
          // Silently returns to its old tray/board spot (no state change);
          // nothing to settle towards, so just drop the floating piece.
          setDraggingId(null);
        }
        return;
      }

      onSessionChangeRef.current(dropPiece({ ...common, position, snapThreshold: placeThreshold }));
      impact('medium');
      playSfx('snap');
      triggerNeighbourJiggle(id);
      flashId.current += 1;
      // The glow ring is drawn at the Canvas root (outside the camera group,
      // so it stays on top of the tray/floating piece), so its position must
      // be pushed through the same live camera transform used above.
      const staticCx = boardOffsetX + (BOARD_PADDING + solved.x + prepared.cx) * boardScale;
      const staticCy = boardOffsetY + (BOARD_PADDING + solved.y + prepared.cy) * boardScale;
      const settledCx = camTx.value + camScale.value * staticCx;
      const settledCy = camTy.value + camScale.value * staticCy;
      setSnapFlash({
        id: flashId.current,
        cx: settledCx,
        cy: settledCy,
      });
      // The just-locked BoardPiece already renders at this exact spot, so the
      // floating piece settling on top of it (shrinking liftScale → 1, tilt →
      // 0) reads as one piece thudding down rather than a visible duplicate.
      settleFloatingPiece(settledCx, settledCy);
    };

    const pan = Gesture.Pan()
      .maxPointers(1)
      .onBegin((e) => {
        'worklet';
        mode.value = 0;
        grabSlot.value = -1;
        grabLoose.value = -1;

        if (e.y < boardZoneH) {
          // Board zone: hit-test loose pieces, topmost (highest z-index) first.
          // The board now renders behind the camera transform (Group
          // transform={cameraTransform} wrapping the static board Group), so
          // the same live camera must be undone here before Task 11's static
          // board-space math — otherwise grabs drift whenever zoomed/panned.
          const preCamX = (e.x - camTx.value) / camScale.value;
          const preCamY = (e.y - camTy.value) / camScale.value;
          const boardX = (preCamX - boardOffsetX) / boardScale - BOARD_PADDING;
          const boardY = (preCamY - boardOffsetY) / boardScale - BOARD_PADDING;
          for (let i = looseBoxes.length - 1; i >= 0; i -= 1) {
            const box = looseBoxes[i];
            if (Math.abs(boardX - box.cx) <= box.halfW && Math.abs(boardY - box.cy) <= box.halfH) {
              mode.value = 1;
              grabLoose.value = i;
              // Instant grab (Task 11): pop straight to lift scale, no tilt yet.
              scaleBoost.value = FX.liftScale;
              tiltDeg.value = 0;
              fx.value = e.x;
              fy.value = e.y;
              runOnJS(beginGrab)(1, i);
              break;
            }
          }
          // Otherwise: empty board space → this one finger pans the camera
          // instead (mode 3). A finger that started on a piece already took
          // mode 1 above; the tray branch below handles its own zone.
          if (mode.value === 0) {
            mode.value = 3;
          }
        } else {
          // Tray zone: a valid slot grabs instantly; empty slot space scrolls.
          const local = e.x - trayScroll.value;
          const slot = Math.floor((local - TRAY_PAD) / slotW);
          if (slot >= 0 && slot < count) {
            mode.value = 1;
            grabSlot.value = slot;
            scaleBoost.value = FX.liftScale;
            tiltDeg.value = 0;
            fx.value = e.x;
            fy.value = e.y;
            runOnJS(beginGrab)(0, slot);
          } else {
            mode.value = 2;
          }
        }
      })
      .onChange((e) => {
        'worklet';
        if (mode.value === 1) {
          fx.value = e.x;
          fy.value = e.y;
          // Live tilt follows pointer velocity directly (no extra spring lag
          // here — `FX.settle` is reserved for the release-to-identity
          // motion), capped at FX.maxTiltDeg either way.
          const rawTilt = e.velocityX * (FX.maxTiltDeg / TILT_VELOCITY_RANGE);
          tiltDeg.value = Math.max(-FX.maxTiltDeg, Math.min(FX.maxTiltDeg, rawTilt));
        } else if (mode.value === 2) {
          trayScroll.value = Math.min(0, Math.max(minScroll, trayScroll.value + e.changeX));
        } else if (mode.value === 3) {
          camPanBy(e.changeX, e.changeY);
        }
      })
      .onFinalize(() => {
        'worklet';
        if (mode.value === 1) {
          const source: 0 | 1 = grabSlot.value >= 0 ? 0 : 1;
          const index = source === 0 ? grabSlot.value : grabLoose.value;
          const dropX = fx.value;
          const dropY = fy.value;
          mode.value = 0;
          grabSlot.value = -1;
          grabLoose.value = -1;
          runOnJS(releasePiece)(source, index, dropX, dropY);
        } else {
          mode.value = 0;
          grabSlot.value = -1;
          grabLoose.value = -1;
        }
      });

    // camDoubleTap and pan are exclusive (a touch either starts a piece
    // grab/tray-scroll/camera-pan via `pan`, or resolves as a double-tap
    // zoom toggle — never both); camPinch (two fingers) runs simultaneously
    // alongside that pair since it never conflicts with a one-finger gesture.
    return Gesture.Simultaneous(Gesture.Exclusive(camDoubleTap, pan), camPinch);
  }, [
    layout,
    trayIds.length,
    looseHitTestData,
    preparedById,
    snapThreshold,
    baselineElapsedMs,
    startedAtMs,
    beginGrab,
    resolveGrabbedId,
    settleFloatingPiece,
    triggerNeighbourJiggle,
    fx,
    fy,
    tiltDeg,
    scaleBoost,
    grabSlot,
    grabLoose,
    mode,
    trayScroll,
    camScale,
    camTx,
    camTy,
    camPanBy,
    camPinch,
    camDoubleTap,
  ]);

  const trayTransform = useDerivedValue(() => [
    { translateX: trayScroll.value },
    { translateY: layout.boardZoneH },
  ]);

  // Hold the first paint until the image is decoded, the play area is
  // measured, and the camera has framed itself — otherwise the board flashes
  // unframed before the camera's identity transform is in place.
  if (!image || viewport.width === 0 || viewport.height === 0 || !camReady) {
    return <View style={styles.measure} onLayout={onLayout} />;
  }

  const { boardScale, boardOffsetX, boardOffsetY, boardZoneH, slotW, thumbScale, vw } = layout;
  const gridLines = Array.from({ length: gridSize - 1 }, (_, i) => cellSize * (i + 1));

  return (
    <View style={styles.measure} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={{ width: viewport.width, height: viewport.height }}>
          <Canvas style={{ width: viewport.width, height: viewport.height }}>
            {/* Tray backdrop */}
            <Rect
              x={0}
              y={boardZoneH}
              width={vw}
              height={TRAY_HEIGHT}
              color={colors.paper}
              opacity={0.5}
            />
            <Line
              p1={vec(0, boardZoneH)}
              p2={vec(vw, boardZoneH)}
              color="rgba(23,33,33,0.12)"
              style="stroke"
              strokeWidth={1}
            />

            {/* Board zone: cameraTransform ∘ staticBoardTransform. At rest
                (scale 1, translate 0) the camera is the identity, so this is
                pixel-identical to the Task 11 static framing alone.
                The outer clip Group carries NO transform of its own, so its
                clip rect is evaluated in the Canvas' fixed screen space —
                Skia concats a Group's own `transform` before applying its
                `clip` (see saveCTM), so a clip placed on the SAME node as
                cameraTransform would scale/pan with the camera and clip
                nothing new. Clipping here, above the camera, keeps the
                board zone boundary pinned to the tray line regardless of
                zoom/pan. */}
            <Group clip={rect(0, 0, vw, boardZoneH)}>
              <Group transform={cameraTransform}>
                <Group
                  transform={[
                    { translateX: boardOffsetX },
                    { translateY: boardOffsetY },
                    { scale: boardScale },
                  ]}
                >
                  <RoundedRect
                    x={BOARD_PADDING - 6}
                    y={BOARD_PADDING - 6}
                    width={boardSize.width + 12}
                    height={boardSize.height + 12}
                    r={18}
                    color={colors.surface}
                  />
                  <Rect
                    x={BOARD_PADDING}
                    y={BOARD_PADDING}
                    width={boardSize.width}
                    height={boardSize.height}
                    color="rgba(185,205,189,0.22)"
                  />
                  <Group transform={[{ translateX: BOARD_PADDING }, { translateY: BOARD_PADDING }]}>
                    {/* Faint cell grid to guide placement */}
                    {gridLines.map((x, i) => (
                      <Line
                        key={`v${i}`}
                        p1={vec(x, 0)}
                        p2={vec(x, boardSize.height)}
                        color="rgba(23,33,33,0.07)"
                        style="stroke"
                        strokeWidth={1}
                      />
                    ))}
                    {gridLines.map((y, i) => (
                      <Line
                        key={`h${i}`}
                        p1={vec(0, y)}
                        p2={vec(boardSize.width, y)}
                        color="rgba(23,33,33,0.07)"
                        style="stroke"
                        strokeWidth={1}
                      />
                    ))}
                    <Rect
                      x={0}
                      y={0}
                      width={boardSize.width}
                      height={boardSize.height}
                      style="stroke"
                      strokeWidth={2}
                      color="rgba(23,33,33,0.14)"
                    />

                    {lockedPieces.map((piece) => {
                      const jiggleToken = jiggleTokens[piece.pieceId];
                      if (jiggleToken) {
                        return (
                          <JigglingBoardPiece
                            key={`${piece.pieceId}:${jiggleToken}`}
                            prepared={preparedById[piece.pieceId]}
                            image={image}
                            imageScale={imageScale}
                            onDone={() => clearJiggle(piece.pieceId, jiggleToken)}
                          />
                        );
                      }
                      return (
                        <BoardPiece
                          key={piece.pieceId}
                          prepared={preparedById[piece.pieceId]}
                          image={image}
                          imageScale={imageScale}
                        />
                      );
                    })}

                    {/* Loose pieces: unlocked misses resting on the board, re-grabbable. */}
                    {loosePieces.map((piece) => (
                      <LoosePiece
                        key={piece.pieceId}
                        prepared={preparedById[piece.pieceId]}
                        image={image}
                        imageScale={imageScale}
                        position={piece.position}
                        hidden={piece.pieceId === draggingId}
                      />
                    ))}
                  </Group>
                </Group>
              </Group>
            </Group>

            {/* Tray zone */}
            <Group transform={trayTransform}>
              {trayPieces.map((piece, index) => (
                <TrayPiece
                  key={piece.pieceId}
                  prepared={preparedById[piece.pieceId]}
                  image={image}
                  imageScale={imageScale}
                  slotCenterX={TRAY_PAD + index * slotW + slotW / 2}
                  slotCenterY={TRAY_HEIGHT / 2}
                  scale={thumbScale}
                  highlight={highlightEdges && preparedById[piece.pieceId].isEdge}
                  hidden={piece.pieceId === draggingId}
                />
              ))}
            </Group>

            {/* Floating piece (above everything) */}
            {draggingPrepared ? (
              <FloatingPiece
                prepared={draggingPrepared}
                image={image}
                imageScale={imageScale}
                boardScale={boardScale}
                camScale={camScale}
                fx={fx}
                fy={fy}
                tiltDeg={tiltDeg}
                scaleBoost={scaleBoost}
              />
            ) : null}

            {snapFlash ? (
              <GlowRing
                key={snapFlash.id}
                id={snapFlash.id}
                cx={snapFlash.cx}
                cy={snapFlash.cy}
                onDone={clearFlash}
              />
            ) : null}
          </Canvas>

          {complete ? <Confetti width={viewport.width} height={viewport.height} /> : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  measure: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
