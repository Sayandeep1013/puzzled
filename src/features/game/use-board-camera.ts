/* eslint-disable react-hooks/immutability --
 * Reanimated shared values are mutated in worklets and read on the JS thread by design.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import type { Point, Size } from '@/game-engine';

export interface BoardCameraInput {
  /** Full world extent (board + tray overhang), in board units. */
  world: Size;
  /** Measured play-area size, in points. */
  viewport: Size;
  /** Solved board size (without padding), in board units. */
  board: Size;
  /** Padding around the board inside the world, in board units. */
  boardPadding: number;
  /** Logical cell size for this grid, used to pick a comfortable default zoom. */
  cellSize: number;
}

export interface BoardCamera {
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  /** False until the camera has framed itself; gate the first paint on this to avoid a flash. */
  ready: boolean;
  pinch: ReturnType<typeof Gesture.Pinch>;
  doubleTap: ReturnType<typeof Gesture.Tap>;
  /** Pan the camera by a screen-space delta (worklet). */
  panBy: (dx: number, dy: number) => void;
  /** Screen point → world point. Reads shared values on the JS thread. */
  toWorld: (screenX: number, screenY: number) => Point;
  /** Animate back to the default framing. */
  recenter: () => void;
}

/** A piece should read ≈ this many points on screen at the default zoom. */
const TARGET_PIECE_PT = 66;
const MIN_PIECE_PT = 46;
/** Keep at least this much content on-screen when panning, in points. */
const EDGE_MARGIN = 48;

export function useBoardCamera({
  world,
  viewport,
  board,
  boardPadding,
  cellSize,
}: BoardCameraInput): BoardCamera {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  // Captured at pinch start so scaling stays anchored to the focal point.
  const startScale = useSharedValue(1);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  const didInit = useRef(false);
  const [ready, setReady] = useState(false);

  const frame = useMemo(() => {
    const vw = viewport.width;
    const vh = viewport.height;
    const worldW = Math.max(world.width, 1);
    const worldH = Math.max(world.height, 1);

    // "See everything" floor and a board-fitting default that never lets pieces
    // shrink below a comfortable touch target (denser boards then pan instead).
    const fitWorld = Math.min(vw / worldW, vh / worldH);
    const fitBoardWidth = (vw * 0.92) / (board.width + boardPadding * 2);
    const comfortable = Math.max(fitBoardWidth, MIN_PIECE_PT / cellSize);
    const target = Math.max(comfortable, TARGET_PIECE_PT / cellSize);

    const minScale = Math.min(fitWorld, comfortable);
    const maxScale = Math.max(target * 2.5, 3);
    const defaultScale = Math.min(maxScale, Math.max(minScale, target));

    // Default framing: board centred horizontally, its top near the screen top.
    const boardCenterX = boardPadding + board.width / 2;
    const defaultTx = vw / 2 - boardCenterX * defaultScale;
    const defaultTy = 24 - (boardPadding - 6) * defaultScale;

    return { vw, vh, worldW, worldH, minScale, maxScale, defaultScale, defaultTx, defaultTy };
  }, [viewport.width, viewport.height, world.width, world.height, board.width, boardPadding, cellSize]);

  // Frame once when the viewport is first measured; never yank the camera mid-play.
  useEffect(() => {
    if (didInit.current || viewport.width === 0 || viewport.height === 0) {
      return;
    }
    didInit.current = true;
    scale.value = frame.defaultScale;
    translateX.value = frame.defaultTx;
    translateY.value = frame.defaultTy;
    setReady(true);
  }, [frame, scale, translateX, translateY, viewport.width, viewport.height]);

  const gestures = useMemo(() => {
    const { vw, vh, worldW, worldH, minScale, maxScale, defaultScale, defaultTx, defaultTy } = frame;

    const clampX = (tx: number, sc: number) => {
      'worklet';
      const scaledW = worldW * sc;
      if (scaledW <= vw) {
        return (vw - scaledW) / 2;
      }
      return Math.min(EDGE_MARGIN, Math.max(vw - scaledW - EDGE_MARGIN, tx));
    };
    const clampY = (ty: number, sc: number) => {
      'worklet';
      const scaledH = worldH * sc;
      if (scaledH <= vh) {
        return (vh - scaledH) / 2;
      }
      return Math.min(EDGE_MARGIN, Math.max(vh - scaledH - EDGE_MARGIN, ty));
    };

    const pinch = Gesture.Pinch()
      .onBegin(() => {
        'worklet';
        startScale.value = scale.value;
        startTx.value = translateX.value;
        startTy.value = translateY.value;
      })
      .onUpdate((e) => {
        'worklet';
        const next = Math.min(maxScale, Math.max(minScale, startScale.value * e.scale));
        const worldFx = (e.focalX - startTx.value) / startScale.value;
        const worldFy = (e.focalY - startTy.value) / startScale.value;
        scale.value = next;
        translateX.value = clampX(e.focalX - worldFx * next, next);
        translateY.value = clampY(e.focalY - worldFy * next, next);
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(260)
      .onEnd((e) => {
        'worklet';
        const zoomedIn = scale.value > defaultScale + 0.02;
        if (zoomedIn) {
          scale.value = withTiming(defaultScale, { duration: 220 });
          translateX.value = withTiming(defaultTx, { duration: 220 });
          translateY.value = withTiming(defaultTy, { duration: 220 });
          return;
        }
        const next = Math.min(maxScale, defaultScale * 2);
        const worldFx = (e.x - translateX.value) / scale.value;
        const worldFy = (e.y - translateY.value) / scale.value;
        scale.value = withTiming(next, { duration: 220 });
        translateX.value = withTiming(clampX(e.x - worldFx * next, next), { duration: 220 });
        translateY.value = withTiming(clampY(e.y - worldFy * next, next), { duration: 220 });
      });

    const panBy = (dx: number, dy: number) => {
      'worklet';
      const sc = scale.value;
      translateX.value = clampX(translateX.value + dx, sc);
      translateY.value = clampY(translateY.value + dy, sc);
    };

    return { pinch, doubleTap, panBy };
  }, [frame, scale, translateX, translateY, startScale, startTx, startTy]);

  const toWorld = (screenX: number, screenY: number): Point => ({
    x: (screenX - translateX.value) / scale.value,
    y: (screenY - translateY.value) / scale.value,
  });

  const recenter = () => {
    scale.value = withTiming(frame.defaultScale, { duration: 220 });
    translateX.value = withTiming(frame.defaultTx, { duration: 220 });
    translateY.value = withTiming(frame.defaultTy, { duration: 220 });
  };

  return {
    scale,
    translateX,
    translateY,
    ready,
    pinch: gestures.pinch,
    doubleTap: gestures.doubleTap,
    panBy: gestures.panBy,
    toWorld,
    recenter,
  };
}
