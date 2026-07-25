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
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import {
  dropPiece,
  isWithinSnapDistance,
  raisePiece,
  snapThresholdForCellSize,
  TAB_SIZE_RATIO,
  type GameSession,
  type GeneratedPuzzle,
  type PieceEdges,
  type PieceGeometry,
  type PieceLocalPath,
  type Size,
} from '@/game-engine';
import { commandsToSkPath } from '@/game-engine/rendering';
import { colors } from '@/shared/theme';

import { FX, impact, success } from './board-fx';

const BOARD_PADDING = 12;
const TRAY_HEIGHT = 132;
const TRAY_PAD = 12;
const SLOT_GAP = 6;
const CONFETTI_COLORS = [colors.primary, colors.gold, colors.accent, colors.sage, colors.rose];

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
        color={highlight ? colors.accent : 'rgba(23,33,33,0.28)'}
      />
    </Group>
  );
});

/** The piece under the finger, drawn at board scale and tracking the finger exactly. */
function FloatingPiece({
  prepared,
  image,
  imageScale,
  boardScale,
  fx,
  fy,
}: {
  prepared: PreparedPiece;
  image: SkImage;
  imageScale: number;
  boardScale: number;
  fx: SharedValue<number>;
  fy: SharedValue<number>;
}) {
  const transform = useDerivedValue(() => [
    { translateX: fx.value },
    { translateY: fy.value },
    { scale: boardScale * FX.liftScale },
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
    <Circle cx={cx} cy={cy} r={radius} style="stroke" strokeWidth={3} color={colors.accent} opacity={opacity} />
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

function ConfettiPiece({ particle, t, height }: { particle: Particle; t: SharedValue<number>; height: number }) {
  const transform = useDerivedValue(() => {
    const span = 1 - particle.delay;
    const tt = Math.min(1, Math.max(0, (t.value - particle.delay) / span));
    const y = particle.startY + tt * (height + 80);
    const x = particle.startX + Math.sin(tt * 6 + particle.i) * particle.drift;
    return [{ translateX: x }, { translateY: y }, { rotate: tt * particle.spin }];
  });
  const opacity = useDerivedValue(() => (t.value < 0.85 ? 1 : Math.max(0, 1 - (t.value - 0.85) / 0.15)));
  return (
    <Group transform={transform} opacity={opacity}>
      <RoundedRect x={0} y={0} width={particle.size} height={particle.size * 0.5} r={1.5} color={particle.color} />
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

  // Finger position of the floating piece, in canvas coordinates.
  const fx = useSharedValue(0);
  const fy = useSharedValue(0);
  const trayScroll = useSharedValue(0);
  /** 0 undecided · 1 dragging a piece · 2 scrolling the tray. */
  const mode = useSharedValue(0);
  const grabSlot = useSharedValue(-1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const flashId = useRef(0);

  const sessionRef = useRef(session);
  const onSessionChangeRef = useRef(onSessionChange);
  const unplacedIdsRef = useRef<string[]>([]);
  const celebratedRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    onSessionChangeRef.current = onSessionChange;
  }, [onSessionChange]);

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

  // Locked pieces live on the board; everything else waits in the tray (stable order).
  const lockedPieces = useMemo(() => session.pieces.filter((p) => p.isLocked), [session.pieces]);
  const unplaced = useMemo(() => session.pieces.filter((p) => !p.isLocked), [session.pieces]);
  const unplacedIds = useMemo(() => unplaced.map((p) => p.pieceId), [unplaced]);
  useEffect(() => {
    unplacedIdsRef.current = unplacedIds;
  }, [unplacedIds]);

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

    return { vw, vh, boardZoneH, boardScale, boardOffsetX, boardOffsetY, slotW, thumbScale, slotInner };
  }, [viewport.width, viewport.height, boardSize.width, boardSize.height, cellSize]);

  const draggingPrepared = draggingId ? preparedById[draggingId] : null;

  const complete = session.status === 'completed';
  useEffect(() => {
    if (complete && !celebratedRef.current) {
      celebratedRef.current = true;
      success();
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

  const beginGrab = useCallback((slot: number) => {
    const id = unplacedIdsRef.current[slot];
    if (id) {
      setDraggingId(id);
      impact('light');
    }
  }, []);

  const trayScrollRef = useRef(0);
  useEffect(() => {
    // Keep a JS mirror so re-layout can clamp without reading the shared value.
    trayScrollRef.current = 0;
  }, [unplacedIds.length]);

  const gesture = useMemo(() => {
    const { boardZoneH, boardScale, boardOffsetX, boardOffsetY, slotW, vw } = layout;
    const count = unplacedIds.length;
    const contentW = count * slotW + TRAY_PAD * 2;
    const minScroll = Math.min(0, vw - contentW);

    const placeFromTray = (slot: number, canvasX: number, canvasY: number) => {
      const id = unplacedIdsRef.current[slot];
      setDraggingId(null);
      if (!id) {
        return;
      }
      const prepared = preparedById[id];
      if (!prepared) {
        return;
      }
      // Canvas → board piece-space; the piece is centred on the finger.
      const boardX = (canvasX - boardOffsetX) / boardScale - BOARD_PADDING;
      const boardY = (canvasY - boardOffsetY) / boardScale - BOARD_PADDING;
      const position = { x: boardX - prepared.cx, y: boardY - prepared.cy };
      const solved = prepared.geometry.solvedPosition;

      const placeThreshold = snapThreshold;
      if (!isWithinSnapDistance(position, solved, placeThreshold)) {
        return; // Miss → the piece simply reappears in the tray.
      }

      const now = new Date().toISOString();
      const raised = raisePiece(sessionRef.current, id, now);
      onSessionChangeRef.current(
        dropPiece({
          session: raised,
          pieceId: id,
          position,
          solvedPosition: solved,
          now,
          elapsedMs: baselineElapsedMs + (Date.now() - startedAtMs),
          snapThreshold: placeThreshold,
        }),
      );
      impact('medium');
      flashId.current += 1;
      setSnapFlash({
        id: flashId.current,
        cx: boardOffsetX + (BOARD_PADDING + solved.x + prepared.cx) * boardScale,
        cy: boardOffsetY + (BOARD_PADDING + solved.y + prepared.cy) * boardScale,
      });
    };

    return Gesture.Pan()
      .maxPointers(1)
      .onBegin((e) => {
        'worklet';
        startX.value = e.x;
        startY.value = e.y;
        mode.value = 0;
        if (e.y >= boardZoneH) {
          const local = e.x - trayScroll.value;
          const slot = Math.floor((local - TRAY_PAD) / slotW);
          grabSlot.value = slot >= 0 && slot < count ? slot : -1;
        } else {
          grabSlot.value = -1;
        }
      })
      .onChange((e) => {
        'worklet';
        if (mode.value === 0) {
          const dx = e.x - startX.value;
          const dy = e.y - startY.value;
          if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
            return;
          }
          if (grabSlot.value >= 0 && (dy < -6 || Math.abs(dy) >= Math.abs(dx))) {
            mode.value = 1;
            fx.value = e.x;
            fy.value = e.y;
            runOnJS(beginGrab)(grabSlot.value);
          } else {
            mode.value = 2;
          }
        }
        if (mode.value === 1) {
          fx.value = e.x;
          fy.value = e.y;
        } else if (mode.value === 2) {
          trayScroll.value = Math.min(0, Math.max(minScroll, trayScroll.value + e.changeX));
        }
      })
      .onFinalize(() => {
        'worklet';
        if (mode.value === 1) {
          const slot = grabSlot.value;
          const dropX = fx.value;
          const dropY = fy.value;
          mode.value = 0;
          grabSlot.value = -1;
          runOnJS(placeFromTray)(slot, dropX, dropY);
        } else {
          mode.value = 0;
          grabSlot.value = -1;
        }
      });
  }, [
    layout,
    unplacedIds.length,
    preparedById,
    snapThreshold,
    baselineElapsedMs,
    startedAtMs,
    beginGrab,
    fx,
    fy,
    grabSlot,
    mode,
    startX,
    startY,
    trayScroll,
  ]);

  const trayTransform = useDerivedValue(() => [
    { translateX: trayScroll.value },
    { translateY: layout.boardZoneH },
  ]);

  if (!image || viewport.width === 0 || viewport.height === 0) {
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
            <Rect x={0} y={boardZoneH} width={vw} height={TRAY_HEIGHT} color={colors.kraft} opacity={0.5} />
            <Line
              p1={vec(0, boardZoneH)}
              p2={vec(vw, boardZoneH)}
              color="rgba(23,33,33,0.12)"
              style="stroke"
              strokeWidth={1}
            />

            {/* Board zone */}
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

                {lockedPieces.map((piece) => (
                  <BoardPiece
                    key={piece.pieceId}
                    prepared={preparedById[piece.pieceId]}
                    image={image}
                    imageScale={imageScale}
                  />
                ))}
              </Group>
            </Group>

            {/* Tray zone */}
            <Group transform={trayTransform}>
              {unplaced.map((piece, index) => (
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
                fx={fx}
                fy={fy}
              />
            ) : null}

            {snapFlash ? (
              <GlowRing key={snapFlash.id} id={snapFlash.id} cx={snapFlash.cx} cy={snapFlash.cy} onDone={clearFlash} />
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
