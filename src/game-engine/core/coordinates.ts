import type { Point, Size, SourceRect } from './types';

/**
 * Center-crop the source image to the largest square that fits inside it.
 */
export function computeCenterCrop(imageSize: Size): SourceRect {
  if (imageSize.width <= 0 || imageSize.height <= 0) {
    throw new RangeError('Image size must be positive.');
  }

  const side = Math.min(imageSize.width, imageSize.height);

  return {
    x: (imageSize.width - side) / 2,
    y: (imageSize.height - side) / 2,
    width: side,
    height: side,
  };
}

export function computeCellSourceRect(
  crop: SourceRect,
  gridSize: number,
  row: number,
  column: number,
): SourceRect {
  const cellWidth = crop.width / gridSize;
  const cellHeight = crop.height / gridSize;

  return {
    x: crop.x + column * cellWidth,
    y: crop.y + row * cellHeight,
    width: cellWidth,
    height: cellHeight,
  };
}

/**
 * Convert a board-space point into cropped-image pixel coordinates.
 * Board origin is the top-left of the solved grid.
 */
export function boardPointToImagePoint(
  boardPoint: Point,
  boardSize: Size,
  crop: SourceRect,
): Point {
  return {
    x: crop.x + (boardPoint.x / boardSize.width) * crop.width,
    y: crop.y + (boardPoint.y / boardSize.height) * crop.height,
  };
}

export function imagePointToBoardPoint(
  imagePoint: Point,
  boardSize: Size,
  crop: SourceRect,
): Point {
  return {
    x: ((imagePoint.x - crop.x) / crop.width) * boardSize.width,
    y: ((imagePoint.y - crop.y) / crop.height) * boardSize.height,
  };
}

export function boardPointToScreenPoint(
  boardPoint: Point,
  viewport: { scale: number; offset: Point },
): Point {
  return {
    x: boardPoint.x * viewport.scale + viewport.offset.x,
    y: boardPoint.y * viewport.scale + viewport.offset.y,
  };
}

export function screenPointToBoardPoint(
  screenPoint: Point,
  viewport: { scale: number; offset: Point },
): Point {
  if (viewport.scale === 0) {
    throw new RangeError('Viewport scale must be non-zero.');
  }

  return {
    x: (screenPoint.x - viewport.offset.x) / viewport.scale,
    y: (screenPoint.y - viewport.offset.y) / viewport.scale,
  };
}

/** Normalize board coordinates into 0..1 relative to the board size for durable saves. */
export function normalizeBoardPoint(point: Point, boardSize: Size): Point {
  return {
    x: point.x / boardSize.width,
    y: point.y / boardSize.height,
  };
}

export function denormalizeBoardPoint(point: Point, boardSize: Size): Point {
  return {
    x: point.x * boardSize.width,
    y: point.y * boardSize.height,
  };
}
