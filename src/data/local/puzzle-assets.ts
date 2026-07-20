/**
 * Static puzzle id → bundled image map.
 *
 * Metro can only resolve literal `require` calls at build time, so bundled art
 * cannot be looked up from `puzzle.image.uri` at runtime. Adding a puzzle means
 * one line here plus its catalog entry in `local-puzzle-repository`.
 */
const PUZZLE_IMAGE_MODULES: Record<string, number> = {
  'first-light': require('../../../assets/puzzles/first-light.png'),
};

export function getPuzzleImageModule(puzzleId: string): number | null {
  return PUZZLE_IMAGE_MODULES[puzzleId] ?? null;
}
