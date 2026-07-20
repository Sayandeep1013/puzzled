import { buildPieceLocalPath } from './path';

describe('piece local path', () => {
  it('closes the path and includes a move command', () => {
    const path = buildPieceLocalPath(
      { top: 0, right: 1, bottom: -1, left: 0 },
      { width: 100, height: 100 },
    );

    expect(path.commands[0]).toEqual({ type: 'M', x: 0, y: 0 });
    expect(path.commands.at(-1)).toEqual({ type: 'Z' });
    expect(path.commands.some((command) => command.type === 'C')).toBe(true);
  });

  it('extends bounds beyond the cell when tabs exist', () => {
    const path = buildPieceLocalPath(
      { top: 0, right: 1, bottom: 0, left: 0 },
      { width: 100, height: 100 },
    );

    expect(path.bounds.width).toBeGreaterThan(100);
    expect(path.bounds.x + path.bounds.width).toBeGreaterThan(100);
  });

  it('stays inside the cell for a fully flat piece', () => {
    const path = buildPieceLocalPath(
      { top: 0, right: 0, bottom: 0, left: 0 },
      { width: 80, height: 80 },
    );

    expect(path.bounds).toEqual({ x: 0, y: 0, width: 80, height: 80 });
  });
});
