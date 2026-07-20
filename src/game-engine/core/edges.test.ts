import { assertComplementaryEdges, generateEdgeGrid } from './edges';

describe('edge generation', () => {
  it('is deterministic for the same seed and grid', () => {
    const first = generateEdgeGrid(8, 'demo-seed');
    const second = generateEdgeGrid(8, 'demo-seed');
    expect(second).toEqual(first);
  });

  it('changes when the seed changes', () => {
    const first = generateEdgeGrid(8, 'seed-a');
    const second = generateEdgeGrid(8, 'seed-b');
    expect(second).not.toEqual(first);
  });

  it.each([4, 6, 8, 9, 10] as const)('keeps complementary edges for a %s-grid', (gridSize) => {
    const edges = generateEdgeGrid(gridSize, `grid-${gridSize}`);
    expect(() => assertComplementaryEdges(edges)).not.toThrow();
    expect(edges).toHaveLength(gridSize);
    expect(edges[0]).toHaveLength(gridSize);
  });

  it('keeps the outer border flat', () => {
    const edges = generateEdgeGrid(9, 'border');
    for (let index = 0; index < 9; index += 1) {
      expect(edges[0][index].top).toBe(0);
      expect(edges[8][index].bottom).toBe(0);
      expect(edges[index][0].left).toBe(0);
      expect(edges[index][8].right).toBe(0);
    }
  });
});
