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
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const left = piece.position.x + bounds.x;
  const top = piece.position.y + bounds.y;

  return (
    point.x >= left &&
    point.x <= left + bounds.width &&
    point.y >= top &&
    point.y <= top + bounds.height
  );
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

function StaticPiece({
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

  const { geometry, skPath } = prepared;

  return (
    <Group transform={[{ translateX: piece.position.x }, { translateY: piece.position.y }]}>
      <Group clip={skPath}>
        <Image
          image={image}
          x={-geometry.sourceRect.x * imageScale}
          y={-geometry.sourceRect.y * imageScale}
          width={image.width() * imageScale}
          height={image.height() * imageScale}
        />
      </Group>
      <Path
        path={skPath}
        style="stroke"
        strokeWidth={piece.isLocked ? 1 : 1.4}
        color={piece.isLocked ? 'rgba(23,33,33,0.14)' : 'rgba(23,33,33,0.32)'}
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
  const { geometry, skPath } = prepared;

  return (
    <Group transform={transform}>
      <Group clip={skPath}>
        <Image
          image={image}
          x={-geometry.sourceRect.x * imageScale}
          y={-geometry.sourceRect.y * imageScale}
          width={image.width() * imageScale}
          height={image.height() * imageScale}
        />
      </Group>
      <Path path={skPath} style="stroke" strokeWidth={2.2} color="rgba(232,110,69,0.95)" />
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
  const [viewportWidth, setViewportWidth] = useState(0);
  const [startedAtMs] = useState(() => Date.now());
  const [activePieceId, setActivePieceId] = useState<string | null>(null);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const grabOffsetX = useSharedValue(0);
  const grabOffsetY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const activeIdSV = useSharedValue('');
  const scaleSV = useSharedValue(1);
  const paddingSV = useSharedValue(12);

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

  const worldWidth = boardSize.width + boardPadding * 2;
  const worldHeight = Math.max(
    boardSize.height + boardPadding * 2 + boardSize.height * 1.15,
    ...session.pieces.map((piece) => {
      const path = generated.paths[piece.pieceId];
      return piece.position.y + path.bounds.y + path.bounds.height + boardPadding + 24;
    }),
  );

  const scale = viewportWidth > 0 ? Math.min(1, (viewportWidth - 4) / worldWidth) : 1;

  useEffect(() => {
    scaleSV.value = scale;
    paddingSV.value = boardPadding;
  }, [boardPadding, paddingSV, scale, scaleSV]);

  const canvasWidth = worldWidth * scale;
  const canvasHeight = worldHeight * scale;

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
    setViewportWidth(event.nativeEvent.layout.width);
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

      const raised = raisePiece(sessionRef.current, hit.pieceId, new Date().toISOString());
      const piece = raised.pieces.find((entry) => entry.pieceId === hit.pieceId);
      if (!piece) {
        return;
      }

      onSessionChangeRef.current(raised);
      setActivePieceId(hit.pieceId);

      const boardX = canvasX / currentScale - padding;
      const boardY = canvasY / currentScale - padding;
      activeIdSV.value = hit.pieceId;
      dragX.value = piece.position.x;
      dragY.value = piece.position.y;
      grabOffsetX.value = boardX - piece.position.x;
      grabOffsetY.value = boardY - piece.position.y;
      isDragging.value = true;
    };

    const finishDrag = (pieceId: string, x: number, y: number) => {
      const geometry = generatedRef.current.pieces.find((piece) => piece.id === pieceId);
      isDragging.value = false;
      activeIdSV.value = '';
      setActivePieceId(null);

      if (!geometry) {
        return;
      }

      onSessionChangeRef.current(
        dropPiece({
          session: sessionRef.current,
          pieceId,
          position: { x, y },
          solvedPosition: geometry.solvedPosition,
          now: new Date().toISOString(),
          elapsedMs: Date.now() - startedAtMs,
          snapThreshold,
        }),
      );
    };

    return Gesture.Pan()
      .onBegin((event) => {
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
        if (!isDragging.value || activeIdSV.value === '') {
          return;
        }
        runOnJS(finishDrag)(activeIdSV.value, dragX.value, dragY.value);
      });
  }, [
    activeIdSV,
    dragX,
    dragY,
    grabOffsetX,
    grabOffsetY,
    isDragging,
    paddingSV,
    scaleSV,
    snapThreshold,
    startedAtMs,
  ]);

  if (!image || viewportWidth === 0) {
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
    minHeight: 380,
    justifyContent: 'center',
  },
});
