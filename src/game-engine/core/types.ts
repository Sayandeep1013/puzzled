export type GridSize = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type EdgeShape = -1 | 0 | 1;
export type PuzzleStatus = 'not-started' | 'in-progress' | 'completed';
export type SyncState = 'local' | 'pending' | 'synced';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface PuzzleImage {
  uri: string;
  pixelSize: Size;
  blurHash?: string;
}

export interface PuzzleDefinition {
  id: string;
  title: string;
  image: PuzzleImage;
  gridSize: GridSize;
  seed: string;
  revision: number;
}

export interface PieceEdges {
  top: EdgeShape;
  right: EdgeShape;
  bottom: EdgeShape;
  left: EdgeShape;
}

export interface SourceRect extends Point, Size {}

export interface PieceGeometry {
  id: string;
  row: number;
  column: number;
  edges: PieceEdges;
  sourceRect: SourceRect;
  solvedPosition: Point;
}

export interface PieceState {
  pieceId: string;
  position: Point;
  rotation: number;
  isLocked: boolean;
  zIndex: number;
}

export interface GameSession {
  id: string;
  puzzleId: string;
  puzzleRevision: number;
  gridSize: GridSize;
  status: PuzzleStatus;
  pieces: PieceState[];
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  elapsedMs: number;
  syncState: SyncState;
}
