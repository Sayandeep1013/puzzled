import {
  boardPointToImagePoint,
  boardPointToScreenPoint,
  computeCenterCrop,
  denormalizeBoardPoint,
  imagePointToBoardPoint,
  normalizeBoardPoint,
  screenPointToBoardPoint,
} from './coordinates';

describe('coordinates', () => {
  const crop = computeCenterCrop({ width: 2000, height: 1200 });
  const boardSize = { width: 800, height: 800 };

  it('center-crops to the largest square', () => {
    expect(crop).toEqual({ x: 400, y: 0, width: 1200, height: 1200 });
  });

  it('round-trips board ↔ image points', () => {
    const boardPoint = { x: 200, y: 400 };
    const imagePoint = boardPointToImagePoint(boardPoint, boardSize, crop);
    expect(imagePointToBoardPoint(imagePoint, boardSize, crop)).toEqual(boardPoint);
  });

  it('round-trips board ↔ screen points', () => {
    const viewport = { scale: 2, offset: { x: 10, y: 20 } };
    const boardPoint = { x: 40, y: 60 };
    const screenPoint = boardPointToScreenPoint(boardPoint, viewport);
    expect(screenPointToBoardPoint(screenPoint, viewport)).toEqual(boardPoint);
  });

  it('normalizes board points for durable saves', () => {
    const point = { x: 200, y: 400 };
    const normalized = normalizeBoardPoint(point, boardSize);
    expect(normalized).toEqual({ x: 0.25, y: 0.5 });
    expect(denormalizeBoardPoint(normalized, boardSize)).toEqual(point);
  });
});
