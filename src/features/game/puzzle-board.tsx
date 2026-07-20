/* eslint-disable react-hooks/immutability, react-hooks/refs, react-hooks/purity --
 * Reanimated shared values and gesture handlers intentionally mutate `.value` and close over refs.
 */
import {
  Canvas,
  Group,
  Image,
  Path,
  Rect,
  RoundedRect,
  useImage,
  type SkImage,
  type SkPath,
} from '@shopify/react-native-skia';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  dropPiece,
  raisePiece,
  snapThresholdForCellSize,
  type GameSession,
  type GeneratedPuzzle,
  type PieceGeometry,
  type PieceLocalPath,
  type PieceState,
  type Point,
  type Size,
} from '@/game-engine';
import { commandsToSkPath } from '@/game-engine/rendering';
import { colors } from '@/shared/theme';

interface PuzzleBoardProps {
  generated: GeneratedPuzzle;
  session: GameSession;
  imageModule: number;
  onSessionChange: (session: GameSession) => void;
}

interface PreparedPiece {
  geometry: PieceGeometry;
  localPath: PieceLocalPath;
  skPath: SkPath;
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

/*
 * Piece fills are drawn by clipping the shared source image per piece.
 *
 * An earlier revision pre-baked each piece into its own texture with
 * `Skia.Surface.MakeOffscreen` to avoid re-clipping a 1024² image once per piece.
 * That renders correctly nowhere: the offscreen surface is GPU-backed and was
 * being drawn from the JS thread, while the canvas consuming the snapshots runs
 * on Skia's render thread under a different GL context — every piece came back
 * blank on device. Baking has to happen on the render thread (a worklet, or
 * `Atlas`/`Picture`) before it is worth re-attempting.
 */

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
}: {
  piece: PieceState;
  prepared: PreparedPiece;
  image: SkImage;
  imageScale: number;
  hidden: boolean;
}) {
  if (hidden) {
    return null;
  }

  return (
    <Group transform={[{ translateX: piece.position.x }, { translateY: piece.position.y }]}>
      <PieceFill prepared={prepared} image={image} imageScale={imageScale} />
      <Path
        path={prepared.skPath}
        style="stroke"
        strokeWidth={piece.isLocked ? 1 : 1.4}
        color={piece.isLocked ? 'rgba(23,33,33,0.14)' : 'rgba(23,33,33,0.32)'}
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

function FloatingPiece({
  prepared,
  image,
  imageScale,
  x,
  y,
}: {
  prepared: PreparedPiece;
  image: SkImage;
  imageScale: number;
  x: SharedValue<number>;
  y: SharedValue<number>;
}) {
  const transform = useDerivedValue(() => [{ translateX: x.value }, { translateY: y.value }]);

  return (
    <Group transform={transform}>
      <PieceFill prepared={prepared} image={image} imageScale={imageScale} />
      <Path path={prepared.skPath} style="stroke" strokeWidth={2.2} color="rgba(232,110,69,0.95)" />
    </Group>
  );
}

export function PuzzleBoard({
  generated,
  session,
  imageModule,
  onSessionChange,
}: PuzzleBoardProps) {
  const image = useImage(imageModule);
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const [startedAtMs] = useState(() => Date.now());
  // Resuming a saved session must keep the time already banked.
  const [baselineElapsedMs] = useState(() => session.elapsedMs);
  const [activePieceId, setActivePieceId] = useState<string | null>(null);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const grabOffsetX = useSharedValue(0);
  const grabOffsetY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const activeIdSV = useSharedValue('');
  const scaleSV = useSharedValue(1);
  const paddingSV = useSharedValue(12);
  /** True between onBegin and onFinalize, so a tap that ends before the JS-thread
   *  hit test resolves does not strand a piece in the dragging state. */
  const gestureActive = useSharedValue(false);

  const sessionRef = useRef(session);
  const onSessionChangeRef = useRef(onSessionChange);
  const generatedRef = useRef(generated);
  const preparedRef = useRef<Record<string, PreparedPiece>>({});

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    onSessionChangeRef.current = onSessionChange;
  }, [onSessionChange]);

  useEffect(() => {
    generatedRef.current = generated;
  }, [generated]);

  const boardPadding = 12;
  const cellSize = generated.cellSize.width;
  const boardSize = generated.boardSize;

  /**
   * World extent is measured once from the opening layout — board plus every piece's
   * tab overhang. Deriving it from live positions instead would rescale the canvas
   * mid-drag, and pieces only ever move inward toward the board.
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
      width: maxX + boardPadding * 2,
      height: maxY + boardPadding * 2,
    };
  });

  // Must fit BOTH axes: fitting width alone pushed the tray outside the clipped
  // container, leaving the bottom rows unreachable on every phone-sized screen.
  const scale =
    viewport.width > 0 && viewport.height > 0
      ? Math.min(1, viewport.width / world.width, viewport.height / world.height)
      : 1;

  useEffect(() => {
    scaleSV.value = scale;
    paddingSV.value = boardPadding;
  }, [boardPadding, paddingSV, scale, scaleSV]);

  const canvasWidth = world.width * scale;
  const canvasHeight = world.height * scale;

  const preparedById = useMemo(() => {
    const map: Record<string, PreparedPiece> = {};
    for (const geometry of generated.pieces) {
      const localPath = generated.paths[geometry.id];
      map[geometry.id] = {
        geometry,
        localPath,
        skPath: commandsToSkPath(localPath.commands),
      };
    }
    return map;
  }, [generated]);

  useEffect(() => {
    preparedRef.current = preparedById;
  }, [preparedById]);

  const imageScale = boardSize.width / generated.crop.width;
  const snapThreshold = snapThresholdForCellSize(cellSize);

  const sortedPieces = useMemo(
    () => [...session.pieces].sort((a, b) => a.zIndex - b.zIndex),
    [session.pieces],
  );

  const activePrepared = activePieceId ? preparedById[activePieceId] : null;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  };

  const panGesture = useMemo(() => {
    const tryBegin = (canvasX: number, canvasY: number) => {
      const currentScale = scaleSV.value;
      const padding = paddingSV.value;
      const boardPoint = {
        x: canvasX / currentScale - padding,
        y: canvasY / currentScale - padding,
      };
      const hit = findTopPieceAt(boardPoint, sessionRef.current, preparedRef.current);
      if (!hit) {
        return;
      }

      // The gesture may already have ended while this hop to the JS thread was
      // in flight; committing now would leave the piece hidden with no finalize.
      if (!gestureActive.value) {
        return;
      }

      // Deliberately no session update here. Z-order is committed on drop, so
      // touching a piece no longer re-renders the whole board.
      setActivePieceId(hit.pieceId);
      activeIdSV.value = hit.pieceId;
      dragX.value = hit.position.x;
      dragY.value = hit.position.y;
      grabOffsetX.value = boardPoint.x - hit.position.x;
      grabOffsetY.value = boardPoint.y - hit.position.y;
      isDragging.value = true;
    };

    const finishDrag = (pieceId: string, x: number, y: number) => {
      const geometry = generatedRef.current.pieces.find((piece) => piece.id === pieceId);
      setActivePieceId(null);

      if (!geometry) {
        return;
      }

      // Raise then drop in one commit: a single state update per completed drag.
      const now = new Date().toISOString();
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
    };

    return Gesture.Pan()
      .onBegin((event) => {
        gestureActive.value = true;
        runOnJS(tryBegin)(event.x, event.y);
      })
      .onChange((event) => {
        if (!isDragging.value) {
          return;
        }
        const boardX = event.x / scaleSV.value - paddingSV.value;
        const boardY = event.y / scaleSV.value - paddingSV.value;
        dragX.value = boardX - grabOffsetX.value;
        dragY.value = boardY - grabOffsetY.value;
      })
      .onFinalize(() => {
        gestureActive.value = false;

        if (!isDragging.value || activeIdSV.value === '') {
          return;
        }

        const pieceId = activeIdSV.value;
        isDragging.value = false;
        activeIdSV.value = '';
        runOnJS(finishDrag)(pieceId, dragX.value, dragY.value);
      });
  }, [
    activeIdSV,
    baselineElapsedMs,
    dragX,
    dragY,
    gestureActive,
    grabOffsetX,
    grabOffsetY,
    isDragging,
    paddingSV,
    scaleSV,
    snapThreshold,
    startedAtMs,
  ]);

  if (!image || viewport.width === 0 || viewport.height === 0) {
    return <View style={styles.measure} onLayout={onLayout} />;
  }

  return (
    <View style={styles.measure} onLayout={onLayout}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={{ width: canvasWidth, height: canvasHeight, alignSelf: 'center' }}>
          <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
            <Group transform={[{ scale }]}>
              <RoundedRect
                x={boardPadding - 6}
                y={boardPadding - 6}
                width={boardSize.width + 12}
                height={boardSize.height + 12}
                r={18}
                color={colors.surface}
              />
              <Rect
                x={boardPadding}
                y={boardPadding}
                width={boardSize.width}
                height={boardSize.height}
                color="rgba(185,205,189,0.28)"
              />
              <Rect
                x={boardPadding}
                y={boardPadding}
                width={boardSize.width}
                height={boardSize.height}
                style="stroke"
                strokeWidth={2}
                color="rgba(23,33,33,0.14)"
              />

              <Group transform={[{ translateX: boardPadding }, { translateY: boardPadding }]}>
                {sortedPieces.map((piece) => (
                  <StaticPiece
                    key={piece.pieceId}
                    piece={piece}
                    prepared={preparedById[piece.pieceId]}
                    image={image}
                    imageScale={imageScale}
                    hidden={piece.pieceId === activePieceId}
                  />
                ))}

                {activePieceId && activePrepared ? (
                  <FloatingPiece
                    prepared={activePrepared}
                    image={image}
                    imageScale={imageScale}
                    x={dragX}
                    y={dragY}
                  />
                ) : null}
              </Group>
            </Group>
          </Canvas>
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
});
