import { FX } from './board-fx';

/**
 * These guard tuning the user asked for after playing on a device: the neighbour
 * jiggle was too strong, and the post-lock ring was a loud orange flash. Both are
 * easy to creep back up, so the intent is pinned here rather than left in a
 * commit message.
 */
describe('FX tuning', () => {
  it('keeps the neighbour jiggle subtle', () => {
    expect(FX.jiggleAmplitude).toBeLessThanOrEqual(1);
    expect(FX.jiggleMs).toBeLessThanOrEqual(140);
  });

  describe('lock ring', () => {
    it('is green rather than orange', () => {
      // The old value was colors.apricot (#FD9C02). Parse the channels so this
      // asserts the hue, not a string.
      const match = FX.lockRing.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      expect(match).not.toBeNull();
      const [r, g, b] = match!.slice(1, 4).map(Number);
      expect(g).toBeGreaterThan(r);
      expect(g).toBeGreaterThan(b);
    });

    it('stays faint', () => {
      expect(FX.lockRing.peakOpacity).toBeLessThanOrEqual(0.3);
      expect(FX.lockRing.strokeWidth).toBeLessThanOrEqual(2);
    });

    it('fades over roughly half a second to a second', () => {
      expect(FX.lockRing.durationMs).toBeGreaterThanOrEqual(500);
      expect(FX.lockRing.durationMs).toBeLessThanOrEqual(1000);
    });
  });

  describe('depth', () => {
    const luminance = (rgba: string) => {
      const [r, g, b] = rgba.match(/\d+/g)!.slice(0, 3).map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    it('casts a shadow downward rather than rimming pieces in light', () => {
      // The first attempt rimmed pieces in near-white, which read as a glow. The
      // mockup has no light rim at all — it drops a shadow beneath each piece.
      expect(FX.depth.shadowDy).toBeGreaterThan(0);
      expect(FX.depth.shadowBlur).toBeGreaterThan(0);
      // Dark, not light: the guard that stops a white rim coming back.
      expect(luminance(FX.depth.shadowColor)).toBeLessThan(128);
      expect(luminance(FX.depth.edgeColor)).toBeLessThan(128);
    });

    it('gives locked pieces a fainter seam than raised pieces get an edge', () => {
      // Locked pieces are part of the finished picture; embossing them made the
      // assembled image look tiled.
      const edgeAlpha = Number(FX.depth.edgeColor.match(/,\s*([\d.]+)\)$/)?.[1]);
      const seamAlpha = Number(FX.depth.seamColor.match(/,\s*([\d.]+)\)$/)?.[1]);
      expect(seamAlpha).toBeLessThan(edgeAlpha);
      expect(FX.depth.seamWidth).toBeLessThanOrEqual(FX.depth.edgeWidth);
    });
  });

  describe('piece corners', () => {
    it('rounds the silhouette so unplaced border pieces are not sharp', () => {
      expect(FX.pieceCornerRadius).toBeGreaterThan(0);
    });
  });

  describe('tray', () => {
    it('uses multiple rows, so the strip fills the space under the board', () => {
      expect(FX.tray.rows).toBeGreaterThan(1);
    });

    it('fits whole columns, so no piece is left sliced by the screen edge', () => {
      expect(FX.tray.visibleColumns).toBeGreaterThanOrEqual(4);
      expect(Number.isInteger(FX.tray.visibleColumns)).toBe(true);
    });

    it('keeps the slider clear of the piece grid', () => {
      expect(FX.tray.sliderGap).toBeGreaterThan(0);
      expect(FX.tray.sliderHeight).toBeGreaterThan(0);
    });
  });
});
