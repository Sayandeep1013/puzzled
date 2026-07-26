/* eslint-disable react-hooks/immutability --
 * Reanimated shared values are mutated in worklets and read on the JS thread by design.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import type { Point, Size } from '@/game-engine';

export interface BoardCameraInput {
  /**
   * Size of the board zone in canvas points — the fitted-board rect the camera
   * pans/zooms within. NOT the full canvas: the tray strip lives outside this
   * rect and is never touched by the camera.
   *
   * The board zone's own static framing (fit-to-zone scale + centring offset,
   * computed by the caller) already places the board inside this rect at rest.
   * The camera is a pure additional zoom/pan layer on top of that static
   * framing — at scale 1 / translate (0, 0) it is the identity, so the rest
   * state is pixel-identical to having no camera at all.
   */
  viewport: Size;
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
  /**
   * Screen point (canvas space, pre-camera) → the same point with the
   * camera's pan/zoom undone. JS-thread only — reads shared values outside a
   * worklet. Do not call from a UI-thread worklet; inline the equivalent
   * `(p - translate) / scale` there instead.
   */
  toWorld: (screenX: number, screenY: number) => Point;
  /** Animate back to the default (unzoomed, centred) framing. */
  recenter: () => void;
}

/** Camera zoom range, relative to the board's own fitted (1x) framing. */
const MIN_SCALE = 1;
const MAX_SCALE = 3;
/** Keep at least this much content on-screen when panning, in points. */
const EDGE_MARGIN = 48;

export function useBoardCamera({ viewport }: BoardCameraInput): BoardCamera {
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
    const vw = Math.max(viewport.width, 1);
    const vh = Math.max(viewport.height, 1);
    // Rest state is the identity: the board zone's static framing already did
    // the fitting, so the camera itself starts at scale 1 / translate (0, 0).
    return {
      vw,
      vh,
      minScale: MIN_SCALE,
      maxScale: MAX_SCALE,
      defaultScale: 1,
      defaultTx: 0,
      defaultTy: 0,
    };
  }, [viewport.width, viewport.height]);

  // Frame once when the board zone is first measured; never yank the camera mid-play.
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
    const { vw, vh, minScale, maxScale, defaultScale, defaultTx, defaultTy } = frame;

    // The camera's "world" is the board zone rect itself: at scale 1 the
    // (already-fitted) board content exactly fills it, so clamping against
    // vw/vh keeps zoomed content reachable without drifting off the zone.
    const clampX = (tx: number, sc: number) => {
      'worklet';
      const scaledW = vw * sc;
      if (scaledW <= vw) {
        return (vw - scaledW) / 2;
      }
      return Math.min(EDGE_MARGIN, Math.max(vw - scaledW - EDGE_MARGIN, tx));
    };
    const clampY = (ty: number, sc: number) => {
      'worklet';
      const scaledH = vh * sc;
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
