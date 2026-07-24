/* eslint-disable react-hooks/immutability, react-hooks/refs, react-hooks/purity --
 * Reanimated shared values and gesture handlers intentionally mutate `.value` and close over refs.
 */
import {
  Canvas,
  Circle,
  Group,
  Image,
  Path,
  Rect,
  RoundedRect,
  useImage,
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

import { FX, impact, success } from './board-fx';
import { useBoardCamera } from './use-board-camera';

const BOARD_PADDING = 12;
const CONFETTI_COLORS = [colors.primary, colors.gold, colors.accent, colors.sage, colors.rose];

interface PuzzleBoardProps {
  generated: GeneratedPuzzle;
  session: GameSession;
  /** Bundled `require` module id, or a `file://` uri for an imported photo. */
  imageSource: number | string;
  onSessionChange: (session: GameSession) => void;
  /** When true, unplaced border pieces get an accent outline (edges-first helper). */
  highlightEdges?: boolean;
}

interface PreparedPiece {
  geometry: PieceGeometry;
  localPath: PieceLocalPath;
  skPath: SkPath;
  isEdge: boolean;
}

function isEdgePiece(edges: PieceEdges): boolean {
  return edges.top === 0 || edges.right === 0 || edges.bottom === 0 || edges.left === 0;
}

function hitTestPiece(point: Point, piece: PieceState, prepared: PreparedPiece): boolean {
  if (piece.isLocked) {
    return false;
  }

  const { bounds } = prepared.localPath;
  const localX = point.x - piece.position.x;
  const localY = point.y - piece.position.y;

  // Cheap bounds reject before the exact silhouette test.
  if (
    localX < bounds.x ||
    localX > bounds.x + bounds.width ||
    localY < bounds.y ||
    localY > bounds.y + bounds.height
  ) {
    return false;
  }

  // Tray pieces overlap; the bounding box alone grabs the wrong neighbour.
  return prepared.skPath.contains(localX, localY);
}

function findTopPieceAt(
  point: Point,
  session: GameSession,
  preparedById: Record<string, PreparedPiece>,
): PieceState | null {
  const ordered = [...session.pieces].sort((a, b) => b.zIndex - a.zIndex);

  for (const piece of ordered) {
    const prepared = preparedById[piece.pieceId];
    if (prepared && hitTestPiece(point, piece, prepared)) {
      return piece;
    }
  }

  return null;
}

/**
 * Memoized: a drag changes one piece's props, and re-rendering the other 99 to
 * move a single piece is what made large boards stutter.
 */
const StaticPiece = memo(function StaticPiece({
  piece,
  prepared,
  image,
  imageScale,
  hidden,
  highlightEdges,
}: {
  piece: PieceState;
  prepared: PreparedPiece;
  image: SkImage;
  imageScale: number;
  hidden: boolean;
  highlightEdges: boolean;
}) {
  if (hidden) {
    return null;
  }

  // Loose edge pieces glow with the accent when the edges-first helper is on.
  const flagged = highlightEdges && prepared.isEdge && !piece.isLocked;

  return (
    <Group transform={[{ translateX: piece.position.x }, { translateY: piece.position.y }]}>
      <PieceFill prepared={prepared} image={image} imageScale={imageScale} />
      <Path
        path={prepared.skPath}
        style="stroke"
        strokeWidth={flagged ? 2.4 : piece.isLocked ? 1 : 1.4}
        color={
          flagged
            ? colors.accent
            : piece.isLocked
              ? 'rgba(23,33,33,0.14)'
              : 'rgba(23,33,33,0.32)'
        }
      />
    </Group>
  );
});

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

/** Faint silhouette of the active piece at its home slot, revealed as you near it. */
function GhostTarget({
  prepared,
  solved,
  x,
  y,
  magnetRadius,
}: {
  prepared: PreparedPiece;
  solved: Point;
  x: SharedValue<number>;
  y: SharedValue<number>;
  magnetRadius: number;
}) {
  const opacity = useDerivedValue(() => {
    const dx = solved.x - x.value;
    const dy = solved.y - y.value;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= magnetRadius) {
      return 0;
    }
    return (1 - dist / magnetRadius) * 0.55;
  });

  return (
    <Group
      transform={[{ translateX: solved.x }, { translateY: solved.y }]}
      opacity={opacity}
    >
      <Path path={prepared.skPath} color={colors.accent} opacity={0.18} />
      <Path
        path={prepared.skPath}
        style="stroke"
        strokeWidth={2}
        color={colors.accent}
      />
    </Group>
  );
}

/** The dragged piece: lifted (scaled about its centre) with a gentle magnet pull. */
function FloatingPiece({
  prepared,
  image,
  imageScale,
  x,
  y,
  solved,
  magnetRadius,
}: {
  prepared: PreparedPiece;
  image: SkImage;
  imageScale: number;
  x: SharedValue<number>;
  y: SharedValue<number>;
  solved: Point;
  magnetRadius: number;
}) {
  const { bounds } = prepared.localPath;
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  const transform = useDerivedValue(() => {
    const px = x.value;
    const py = y.value;
    const dx = solved.x - px;
    const dy = solved.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let ox = px;
    let oy = py;
    if (dist < magnetRadius && dist > 0.001) {
      const pull = (1 - dist / magnetRadius) * FX.magnetPull;
      ox = px + dx * pull;
      oy = py + dy * pull;
    }
    return [
      { translateX: ox },
      { translateY: oy },
      // Scale about the piece centre so the lift doesn't shift it off the finger.
      { translateX: cx },
      { translateY: cy },
      { scale: FX.liftScale },
      { translateX: -cx },
      { translateY: -cy },
    ];
  });

  return (
    <Group transform={transform}>
      <PieceFill prepared={prepared} image={image} imageScale={imageScale} />
      <Path path={prepared.skPath} style="stroke" strokeWidth={2.4} color="rgba(232,110,69,0.95)" />
    </Group>
  );
}

/** A one-shot ring that pops outward when a piece locks home. */
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

  const radius = useDerivedValue(() => 8 + progress.value * 34);
  const opacity = useDerivedValue(() => (1 - progress.value) * 0.85);

  return (
    <Circle
      cx={cx}
      cy={cy}
      r={radius}
      style="stroke"
      strokeWidth={3}
      color={colors.accent}
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

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: FX.confettiCount }, (_, i) => ({
      i,
      startX: Math.random() * width,
      startY: -20 - Math.random() * height * 0.3,
      delay: Math.random() * 0.35,
      drift: 20 + Math.random() * 40,
      spin: (Math.random() * 8 - 4) * Math.PI,
      size: 8 + Math.random() * 6,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    }));
  }, [width, height]);

  return (
    <Canvas style={[styles.overlay, { width, height }]} pointerEvents="none">
      {particles.map((particle) => (
        <ConfettiPiece key={particle.i} particle={particle} t={t} height={height} />
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
  // Resuming a saved session must keep the time already banked.
  const [baselineElapsedMs] = useState(() => session.elapsedMs);
  const [activePieceId, setActivePieceId] = useState<string | null>(null);
  const [snapFlash, setSnapFlash] = useState<{ id: number; cx: number; cy: number } | null>(null);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const grabOffsetX = useSharedValue(0);
  const grabOffsetY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const activeIdSV = useSharedValue('');
  /** 0 = undecided, 1 = dragging a piece, 2 = panning the camera. */
  const dragMode = useSharedValue(0);
  /** True between onBegin and onFinalize, so a tap that ends before the JS-thread
   *  hit test resolves does not strand a piece in the dragging state. */
  const gestureActive = useSharedValue(false);
  const flashId = useRef(0);

  const sessionRef = useRef(session);
  const onSessionChangeRef = useRef(onSessionChange);
  const generatedRef = useRef(generated);
  const preparedRef = useRef<Record<string, PreparedPiece>>({});
  const celebratedRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    onSessionChangeRef.current = onSessionChange;
  }, [onSessionChange]);

  useEffect(() => {
    generatedRef.current = generated;
  }, [generated]);

  const cellSize = generated.cellSize.width;
  const boardSize = generated.boardSize;

  /**
   * World extent is measured once from the opening layout — board plus every piece's
   * tab overhang. Deriving it from live positions instead would rescale the camera
   * bounds mid-drag, and pieces only ever move inward toward the board.
   */
  const [world] = useState<Size>(() => {
    let maxX = boardSize.width;
    let maxY = boardSize.height;

    for (const piece of session.pieces) {
      const path = generated.paths[piece.pieceId];
      if (!path) {
        continue; // Tolerate a restored session whose geometry no longer matches.
      }
      maxX = Math.max(maxX, piece.position.x + path.bounds.x + path.bounds.width);
      maxY = Math.max(maxY, piece.position.y + path.bounds.y + path.bounds.height);
    }

    return {
      width: maxX + BOARD_PADDING * 2,
      height: maxY + BOARD_PADDING * 2,
    };
  });

  const camera = useBoardCamera({
    world,
    viewport,
    board: boardSize,
    boardPadding: BOARD_PADDING,
    cellSize,
  });
  // Stable members (shared values + memoized gestures) — pulled out so the
  // gesture memo depends on plain identifiers, not the per-render camera object.
  const {
    scale: camScale,
    translateX: camTx,
    translateY: camTy,
    panBy: camPanBy,
    pinch: camPinch,
    doubleTap: camDoubleTap,
    ready: camReady,
  } = camera;

  const cameraTransform = useDerivedValue(() => [
    { translateX: camTx.value },
    { translateY: camTy.value },
    { scale: camScale.value },
  ]);

  const preparedById = useMemo(() => {
    const map: Record<string, PreparedPiece> = {};
    for (const geometry of generated.pieces) {
      const localPath = generated.paths[geometry.id];
      map[geometry.id] = {
        geometry,
        localPath,
        skPath: commandsToSkPath(localPath.commands),
        isEdge: isEdgePiece(geometry.edges),
      };
    }
    return map;
  }, [generated]);

  useEffect(() => {
    preparedRef.current = preparedById;
  }, [preparedById]);

  const imageScale = boardSize.width / generated.crop.width;
  const snapThreshold = snapThresholdForCellSize(cellSize);
  const magnetRadius = snapThreshold * FX.magnetRatio;

  const sortedPieces = useMemo(
    () => [...session.pieces].sort((a, b) => a.zIndex - b.zIndex),
    [session.pieces],
  );

  const activePrepared = activePieceId ? preparedById[activePieceId] : null;

  // Celebrate exactly once when the final piece locks.
  const complete = session.status === 'completed';
  useEffect(() => {
    if (complete && !celebratedRef.current) {
      celebratedRef.current = true;
      success();
    }
  }, [complete]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  };

  const clearFlash = useCallback(
    (id: number) => setSnapFlash((current) => (current && current.id === id ? null : current)),
    [],
  );

  const gesture = useMemo(() => {
    const tryBegin = (screenX: number, screenY: number) => {
      // Screen → world → board-piece space, reading the live camera on the JS thread.
      const sc = camScale.value;
      const worldX = (screenX - camTx.value) / sc;
      const worldY = (screenY - camTy.value) / sc;
      const boardPoint = { x: worldX - BOARD_PADDING, y: worldY - BOARD_PADDING };
      const hit = findTopPieceAt(boardPoint, sessionRef.current, preparedRef.current);

      if (!hit) {
        dragMode.value = 2; // Empty space → pan the camera.
        return;
      }

      // The gesture may already have ended while this hop to the JS thread was
      // in flight; committing now would leave the piece hidden with no finalize.
      if (!gestureActive.value) {
        return;
      }

      setActivePieceId(hit.pieceId);
      activeIdSV.value = hit.pieceId;
      dragX.value = hit.position.x;
      dragY.value = hit.position.y;
      grabOffsetX.value = boardPoint.x - hit.position.x;
      grabOffsetY.value = boardPoint.y - hit.position.y;
      isDragging.value = true;
      dragMode.value = 1;
      impact('light');
    };

    const finishDrag = (pieceId: string, x: number, y: number) => {
      const geometry = generatedRef.current.pieces.find((piece) => piece.id === pieceId);
      setActivePieceId(null);

      if (!geometry) {
        return;
      }

      const now = new Date().toISOString();
      const snapped = isWithinSnapDistance({ x, y }, geometry.solvedPosition, snapThreshold);

      // Raise then drop in one commit: a single state update per completed drag.
      const raised = raisePiece(sessionRef.current, pieceId, now);
      onSessionChangeRef.current(
        dropPiece({
          session: raised,
          pieceId,
          position: { x, y },
          solvedPosition: geometry.solvedPosition,
          now,
          elapsedMs: baselineElapsedMs + (Date.now() - startedAtMs),
          snapThreshold,
        }),
      );

      if (snapped) {
        impact('medium');
        const prepared = preparedRef.current[pieceId];
        const bounds = prepared?.localPath.bounds;
        const cx = geometry.solvedPosition.x + (bounds ? bounds.x + bounds.width / 2 : cellSize / 2);
        const cy = geometry.solvedPosition.y + (bounds ? bounds.y + bounds.height / 2 : cellSize / 2);
        flashId.current += 1;
        setSnapFlash({ id: flashId.current, cx, cy });
      }
    };

    const pan = Gesture.Pan()
      .maxPointers(1)
      .onBegin((event) => {
        gestureActive.value = true;
        dragMode.value = 0;
        runOnJS(tryBegin)(event.x, event.y);
      })
      .onChange((event) => {
        if (dragMode.value === 1) {
          if (!isDragging.value) {
            return;
          }
          const worldX = (event.x - camTx.value) / camScale.value;
          const worldY = (event.y - camTy.value) / camScale.value;
          dragX.value = worldX - BOARD_PADDING - grabOffsetX.value;
          dragY.value = worldY - BOARD_PADDING - grabOffsetY.value;
        } else if (dragMode.value === 2) {
          camPanBy(event.changeX, event.changeY);
        }
      })
      .onFinalize(() => {
        gestureActive.value = false;
        const wasDraggingPiece = dragMode.value === 1 && isDragging.value && activeIdSV.value !== '';
        dragMode.value = 0;

        if (!wasDraggingPiece) {
          return;
        }

        const pieceId = activeIdSV.value;
        isDragging.value = false;
        activeIdSV.value = '';
        runOnJS(finishDrag)(pieceId, dragX.value, dragY.value);
      });

    return Gesture.Simultaneous(Gesture.Exclusive(camDoubleTap, pan), camPinch);
  }, [
    activeIdSV,
    baselineElapsedMs,
    camDoubleTap,
    camPanBy,
    camPinch,
    camScale,
    camTx,
    camTy,
    cellSize,
    dragMode,
    dragX,
    dragY,
    gestureActive,
    grabOffsetX,
    grabOffsetY,
    isDragging,
    snapThreshold,
    startedAtMs,
  ]);

  // Hold the first paint until the image is decoded, the play area is measured,
  // and the camera has framed itself — otherwise the board flashes unscaled.
  if (!image || viewport.width === 0 || viewport.height === 0 || !camReady) {
    return <View style={styles.measure} onLayout={onLayout} />;
  }

  return (
    <View style={styles.measure} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={{ width: viewport.width, height: viewport.height }}>
          <Canvas style={{ width: viewport.width, height: viewport.height }}>
            <Group transform={cameraTransform}>
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
                color="rgba(185,205,189,0.28)"
              />
              <Rect
                x={BOARD_PADDING}
                y={BOARD_PADDING}
                width={boardSize.width}
                height={boardSize.height}
                style="stroke"
                strokeWidth={2}
                color="rgba(23,33,33,0.14)"
              />

              <Group transform={[{ translateX: BOARD_PADDING }, { translateY: BOARD_PADDING }]}>
                {sortedPieces.map((piece) => (
                  <StaticPiece
                    key={piece.pieceId}
                    piece={piece}
                    prepared={preparedById[piece.pieceId]}
                    image={image}
                    imageScale={imageScale}
                    hidden={piece.pieceId === activePieceId}
                    highlightEdges={highlightEdges}
                  />
                ))}

                {activePieceId && activePrepared ? (
                  <>
                    <GhostTarget
                      prepared={activePrepared}
                      solved={activePrepared.geometry.solvedPosition}
                      x={dragX}
                      y={dragY}
                      magnetRadius={magnetRadius}
                    />
                    <FloatingPiece
                      prepared={activePrepared}
                      image={image}
                      imageScale={imageScale}
                      x={dragX}
                      y={dragY}
                      solved={activePrepared.geometry.solvedPosition}
                      magnetRadius={magnetRadius}
                    />
                  </>
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
              </Group>
            </Group>
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
