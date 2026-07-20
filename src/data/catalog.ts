import type { PuzzleDefinition } from '@/game-engine';

import { getUserPuzzleRepository } from './local/database';
import { LocalPuzzleRepository } from './local/local-puzzle-repository';

// Re-exported so callers can pull image resolution from the catalog entry point.
export { isUserPuzzle, resolvePuzzleImageSource } from './local/puzzle-assets';

export interface Catalog {
  bundled: PuzzleDefinition[];
  user: PuzzleDefinition[];
}

/** Bundled starter puzzles plus everything the player has imported. */
export async function listCatalog(): Promise<Catalog> {
  const bundled = await new LocalPuzzleRepository().list();

  let user: PuzzleDefinition[] = [];
  try {
    user = await (await getUserPuzzleRepository()).list();
  } catch {
    // A database failure still lets bundled puzzles play.
  }

  return { bundled, user };
}

/** Look up a puzzle by id across bundled and user catalogs. */
export async function getPuzzleById(puzzleId: string): Promise<PuzzleDefinition | null> {
  const bundled = await new LocalPuzzleRepository().getById(puzzleId);
  if (bundled) {
    return bundled;
  }

  try {
    return await (await getUserPuzzleRepository()).getById(puzzleId);
  } catch {
    return null;
  }
}
