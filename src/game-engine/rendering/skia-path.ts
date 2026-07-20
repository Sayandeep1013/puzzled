import { Skia, type SkPath } from '@shopify/react-native-skia';

import type { PathCommand } from '../core/path';

/** Convert engine path commands into a Skia path for clipping and strokes. */
export function commandsToSkPath(commands: readonly PathCommand[]): SkPath {
  const path = Skia.Path.Make();

  for (const command of commands) {
    switch (command.type) {
      case 'M':
        path.moveTo(command.x, command.y);
        break;
      case 'L':
        path.lineTo(command.x, command.y);
        break;
      case 'C':
        path.cubicTo(command.x1, command.y1, command.x2, command.y2, command.x, command.y);
        break;
      case 'Z':
        path.close();
        break;
      default:
        break;
    }
  }

  return path;
}
