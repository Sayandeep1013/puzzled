export function makePieceId(row: number, column: number): string {
  return `${row}:${column}`;
}

export function parsePieceId(pieceId: string): { row: number; column: number } {
  const [rowText, columnText] = pieceId.split(':');
  const row = Number(rowText);
  const column = Number(columnText);

  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0) {
    throw new Error(`Invalid piece id: ${pieceId}`);
  }

  return { row, column };
}
