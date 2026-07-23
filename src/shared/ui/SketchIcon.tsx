import { Canvas, Path, Skia, type SkPath } from '@shopify/react-native-skia';

import { colors } from '@/shared/theme';

export type IconName =
  | 'home'
  | 'explore'
  | 'library'
  | 'profile'
  | 'back'
  | 'chevron'
  | 'close'
  | 'star'
  | 'gear'
  | 'puzzle'
  | 'trophy'
  | 'leaf'
  | 'paw'
  | 'city'
  | 'palette'
  | 'food'
  | 'coin'
  | 'noads'
  | 'chart'
  | 'help'
  | 'check'
  | 'medal'
  | 'sparkle'
  | 'calendar'
  | 'heart'
  | 'eye'
  | 'sound'
  | 'music'
  | 'play'
  | 'restart'
  | 'edit'
  | 'exit';

// All icons are authored in a 24×24 box and scaled to the requested size.
const VIEWBOX = 24;

/** Build each icon as one or more Skia stroke paths in the 24×24 space. */
function buildIcon(name: IconName): SkPath[] {
  const p = Skia.Path.Make();
  switch (name) {
    case 'home':
      p.moveTo(3, 11);
      p.lineTo(12, 3.5);
      p.lineTo(21, 11);
      p.moveTo(5.5, 9.5);
      p.lineTo(5.5, 20.5);
      p.lineTo(18.5, 20.5);
      p.lineTo(18.5, 9.5);
      p.moveTo(9.5, 20.5);
      p.lineTo(9.5, 14);
      p.lineTo(14.5, 14);
      p.lineTo(14.5, 20.5);
      return [p];
    case 'explore': {
      p.addCircle(10.5, 10.5, 6.5);
      const h = Skia.Path.Make();
      h.moveTo(15.5, 15.5);
      h.lineTo(21, 21);
      return [p, h];
    }
    case 'library':
      p.moveTo(12, 5.5);
      p.cubicTo(9, 3.5, 5, 3.8, 3.5, 4.8);
      p.lineTo(3.5, 19);
      p.cubicTo(5, 18, 9, 17.8, 12, 19.6);
      p.cubicTo(15, 17.8, 19, 18, 20.5, 19);
      p.lineTo(20.5, 4.8);
      p.cubicTo(19, 3.8, 15, 3.5, 12, 5.5);
      p.moveTo(12, 5.5);
      p.lineTo(12, 19.6);
      return [p];
    case 'profile': {
      p.addCircle(12, 8, 4);
      const b = Skia.Path.Make();
      b.moveTo(4.5, 20.5);
      b.cubicTo(5.5, 15, 18.5, 15, 19.5, 20.5);
      return [p, b];
    }
    case 'back':
      p.moveTo(15, 4.5);
      p.lineTo(7.5, 12);
      p.lineTo(15, 19.5);
      return [p];
    case 'chevron':
      p.moveTo(9, 5);
      p.lineTo(16, 12);
      p.lineTo(9, 19);
      return [p];
    case 'close':
      p.moveTo(6, 6);
      p.lineTo(18, 18);
      p.moveTo(18, 6);
      p.lineTo(6, 18);
      return [p];
    case 'star':
      p.moveTo(12, 3);
      p.lineTo(14.7, 9);
      p.lineTo(21, 9.6);
      p.lineTo(16.2, 13.9);
      p.lineTo(17.7, 20.5);
      p.lineTo(12, 17);
      p.lineTo(6.3, 20.5);
      p.lineTo(7.8, 13.9);
      p.lineTo(3, 9.6);
      p.lineTo(9.3, 9);
      p.close();
      return [p];
    case 'gear': {
      p.addCircle(12, 12, 3.2);
      const teeth = Skia.Path.Make();
      for (let i = 0; i < 8; i += 1) {
        const a = (Math.PI / 4) * i;
        teeth.moveTo(12 + Math.cos(a) * 6, 12 + Math.sin(a) * 6);
        teeth.lineTo(12 + Math.cos(a) * 8.5, 12 + Math.sin(a) * 8.5);
      }
      return [p, teeth];
    }
    case 'puzzle':
      p.moveTo(4, 5);
      p.lineTo(9, 5);
      p.cubicTo(9, 2.5, 15, 2.5, 15, 5);
      p.lineTo(20, 5);
      p.lineTo(20, 10);
      p.cubicTo(22.5, 10, 22.5, 16, 20, 16);
      p.lineTo(20, 21);
      p.lineTo(15, 21);
      p.cubicTo(15, 23.5, 9, 23.5, 9, 21);
      p.lineTo(4, 21);
      p.lineTo(4, 16);
      p.cubicTo(1.5, 16, 1.5, 10, 4, 10);
      p.close();
      return [p];
    case 'trophy': {
      p.moveTo(7.5, 4.5);
      p.lineTo(16.5, 4.5);
      p.lineTo(16, 11);
      p.cubicTo(15.5, 15, 8.5, 15, 8, 11);
      p.close();
      const handles = Skia.Path.Make();
      handles.moveTo(7.5, 6);
      handles.cubicTo(3.5, 6, 3.5, 11, 8, 11);
      handles.moveTo(16.5, 6);
      handles.cubicTo(20.5, 6, 20.5, 11, 16, 11);
      const stem = Skia.Path.Make();
      stem.moveTo(12, 14.5);
      stem.lineTo(12, 18);
      stem.moveTo(8, 20.5);
      stem.lineTo(16, 20.5);
      stem.moveTo(9.5, 18);
      stem.lineTo(14.5, 18);
      return [p, handles, stem];
    }
    case 'leaf': {
      p.moveTo(6, 18);
      p.cubicTo(6, 8, 12, 4, 19, 5);
      p.cubicTo(20, 12, 16, 18, 6, 18);
      p.close();
      const vein = Skia.Path.Make();
      vein.moveTo(8, 16);
      vein.lineTo(17, 7);
      return [p, vein];
    }
    case 'paw': {
      const pad = Skia.Path.Make();
      pad.addCircle(12, 15.5, 3.6);
      p.addCircle(7.5, 11, 1.9);
      p.addCircle(10.5, 8, 1.9);
      p.addCircle(13.5, 8, 1.9);
      p.addCircle(16.5, 11, 1.9);
      return [p, pad];
    }
    case 'city': {
      p.moveTo(4, 20);
      p.lineTo(4, 11);
      p.lineTo(9, 11);
      p.lineTo(9, 20);
      const mid = Skia.Path.Make();
      mid.moveTo(9, 20);
      mid.lineTo(9, 6.5);
      mid.lineTo(15, 6.5);
      mid.lineTo(15, 20);
      const right = Skia.Path.Make();
      right.moveTo(15, 20);
      right.lineTo(15, 13);
      right.lineTo(20, 13);
      right.lineTo(20, 20);
      const base = Skia.Path.Make();
      base.moveTo(3, 20.3);
      base.lineTo(21, 20.3);
      return [p, mid, right, base];
    }
    case 'palette': {
      p.addCircle(12, 12, 8);
      const dots = Skia.Path.Make();
      dots.addCircle(9, 8.5, 1);
      dots.addCircle(15, 8.5, 1);
      dots.addCircle(8, 13.5, 1);
      dots.addCircle(14.5, 15.5, 1.4);
      return [p, dots];
    }
    case 'food': {
      p.moveTo(4, 12);
      p.cubicTo(4, 19, 20, 19, 20, 12);
      const rim = Skia.Path.Make();
      rim.moveTo(3, 11.5);
      rim.lineTo(21, 11.5);
      const stick = Skia.Path.Make();
      stick.moveTo(15, 4);
      stick.lineTo(19, 10.5);
      return [p, rim, stick];
    }
    case 'coin': {
      p.addCircle(12, 12, 8);
      const inner = Skia.Path.Make();
      inner.addCircle(12, 12, 4.6);
      return [p, inner];
    }
    case 'noads': {
      p.addCircle(12, 12, 8.2);
      const slash = Skia.Path.Make();
      slash.moveTo(6.2, 6.2);
      slash.lineTo(17.8, 17.8);
      return [p, slash];
    }
    case 'chart': {
      p.moveTo(4, 4);
      p.lineTo(4, 20);
      p.lineTo(20, 20);
      const bars = Skia.Path.Make();
      bars.moveTo(8, 20);
      bars.lineTo(8, 14);
      bars.moveTo(12.5, 20);
      bars.lineTo(12.5, 9);
      bars.moveTo(17, 20);
      bars.lineTo(17, 12);
      return [p, bars];
    }
    case 'help': {
      p.addCircle(12, 12, 8);
      const q = Skia.Path.Make();
      q.moveTo(9.3, 9.5);
      q.cubicTo(9.3, 6, 15, 6, 14.4, 10);
      q.cubicTo(14, 12.5, 12, 12.3, 12, 15);
      const dot = Skia.Path.Make();
      dot.addCircle(12, 17.8, 0.5);
      return [p, q, dot];
    }
    case 'check':
      p.moveTo(5, 12.5);
      p.lineTo(10, 17.5);
      p.lineTo(19, 7);
      return [p];
    case 'medal': {
      p.addCircle(12, 15, 5);
      const ribbon = Skia.Path.Make();
      ribbon.moveTo(9, 3);
      ribbon.lineTo(11, 11);
      ribbon.moveTo(15, 3);
      ribbon.lineTo(13, 11);
      return [p, ribbon];
    }
    case 'sparkle':
      p.moveTo(12, 3);
      p.lineTo(13.6, 10.4);
      p.lineTo(21, 12);
      p.lineTo(13.6, 13.6);
      p.lineTo(12, 21);
      p.lineTo(10.4, 13.6);
      p.lineTo(3, 12);
      p.lineTo(10.4, 10.4);
      p.close();
      return [p];
    case 'calendar': {
      p.moveTo(4, 6.5);
      p.lineTo(20, 6.5);
      p.lineTo(20, 20);
      p.lineTo(4, 20);
      p.close();
      const parts = Skia.Path.Make();
      parts.moveTo(4, 10.5);
      parts.lineTo(20, 10.5);
      parts.moveTo(8, 4);
      parts.lineTo(8, 8);
      parts.moveTo(16, 4);
      parts.lineTo(16, 8);
      return [p, parts];
    }
    case 'heart':
      p.moveTo(12, 7);
      p.cubicTo(12, 4, 7, 3.5, 5.5, 7);
      p.cubicTo(4, 10.5, 9, 14, 12, 18);
      p.cubicTo(15, 14, 20, 10.5, 18.5, 7);
      p.cubicTo(17, 3.5, 12, 4, 12, 7);
      p.close();
      return [p];
    case 'eye': {
      p.moveTo(3, 12);
      p.cubicTo(8, 6, 16, 6, 21, 12);
      p.cubicTo(16, 18, 8, 18, 3, 12);
      p.close();
      const pupil = Skia.Path.Make();
      pupil.addCircle(12, 12, 2.6);
      return [p, pupil];
    }
    case 'sound': {
      p.moveTo(4, 10);
      p.lineTo(8, 10);
      p.lineTo(12, 6);
      p.lineTo(12, 18);
      p.lineTo(8, 14);
      p.lineTo(4, 14);
      p.close();
      const waves = Skia.Path.Make();
      waves.moveTo(15, 9);
      waves.cubicTo(17.5, 11, 17.5, 13, 15, 15);
      return [p, waves];
    }
    case 'music': {
      p.moveTo(10, 18);
      p.lineTo(10, 6);
      p.lineTo(18, 4);
      p.lineTo(18, 16);
      const heads = Skia.Path.Make();
      heads.addCircle(8, 18, 2);
      heads.addCircle(16, 16, 2);
      return [p, heads];
    }
    case 'play':
      p.moveTo(8, 6);
      p.lineTo(18, 12);
      p.lineTo(8, 18);
      p.close();
      return [p];
    case 'restart': {
      p.moveTo(18, 7);
      p.cubicTo(21, 11, 19, 18, 12, 19);
      p.cubicTo(6, 19.8, 3, 14, 5, 9);
      p.cubicTo(6.5, 5.5, 11, 4, 15, 5.5);
      const head = Skia.Path.Make();
      head.moveTo(15, 2.5);
      head.lineTo(15.6, 6);
      head.lineTo(12, 6.6);
      return [p, head];
    }
    case 'edit': {
      p.moveTo(4, 20);
      p.lineTo(5, 16);
      p.lineTo(16, 5);
      p.lineTo(19, 8);
      p.lineTo(8, 19);
      p.close();
      const tip = Skia.Path.Make();
      tip.moveTo(14, 7);
      tip.lineTo(17, 10);
      return [p, tip];
    }
    case 'exit': {
      p.moveTo(13, 4);
      p.lineTo(5, 4);
      p.lineTo(5, 20);
      p.lineTo(13, 20);
      const arrow = Skia.Path.Make();
      arrow.moveTo(10, 12);
      arrow.lineTo(20, 12);
      arrow.moveTo(17, 9);
      arrow.lineTo(20, 12);
      arrow.lineTo(17, 15);
      return [p, arrow];
    }
    default:
      return [p];
  }
}

interface SketchIconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** A single hand-drawn line icon rendered with Skia. */
export function SketchIcon({
  name,
  size = 24,
  color = colors.sketch,
  strokeWidth = 2,
}: SketchIconProps) {
  const paths = buildIcon(name);
  const scale = size / VIEWBOX;

  return (
    <Canvas style={{ width: size, height: size }}>
      {paths.map((path, i) => (
        <Path
          key={i}
          path={path}
          style="stroke"
          color={color}
          strokeWidth={strokeWidth / scale}
          strokeJoin="round"
          strokeCap="round"
          transform={[{ scale }]}
        />
      ))}
    </Canvas>
  );
}
