import { FX } from './board-fx';

/**
 * These guard tuning the user asked for after playing on a device: the post-lock
 * ring was a loud orange flash, and the neighbour jiggle was cut entirely. Both
 * are easy to creep back, so the intent is pinned here rather than left in a
 * commit message.
 */
describe('FX tuning', () => {
  it('has no neighbour jiggle at all', () => {
    // Toned down twice (2px → 1px → 0.6px) and rejected each time: placing a
    // piece correctly should feel settled, and nudging its neighbours read as the
    // board being knocked. Removed rather than tuned a third time, so this
    // asserts absence — the guard against it being reintroduced as "subtle".
    expect(Object.keys(FX).filter((key) => key.startsWith('jiggle'))).toEqual([]);
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

    it('still leaves the locked seam visible, since the board is nearly all locked', () => {
      // The seam was `rgba(23,33,33,0.1)` at 1px — a 10%-alpha hairline. Every piece
      // the player places is locked, so however strong the raised shadow was, the
      // board they look at all game had no perceptible depth. "Fainter than raised"
      // above must not be satisfied by fading to nothing again.
      const seamAlpha = Number(FX.depth.seamColor.match(/,\s*([\d.]+)\)$/)?.[1]);
      expect(seamAlpha).toBeGreaterThanOrEqual(0.25);
      expect(FX.depth.seamWidth).toBeGreaterThanOrEqual(1.5);
      // Blurred, so it shades into the piece instead of banding as a drawn outline.
      expect(FX.depth.seamBlur).toBeGreaterThan(0);
    });

    it('only lifts raised pieces off the surface', () => {
      // A locked piece is flush with its neighbours, so an outward drop shadow would
      // be physically wrong; its depth comes from the inward rim alone.
      expect(FX.depth.shadowDy).toBeGreaterThan(0);
      expect(FX.depth.edgeBlur).toBeGreaterThan(0);
    });
  });

  describe('piece corners', () => {
    it('rounds the silhouette so unplaced border pieces are not sharp', () => {
      expect(FX.boardCornerRadius).toBeGreaterThan(0);
    });

    it('exposes exactly one corner radius, shared by the frame and its corner pieces', () => {
      // The board frame clipped at 20 while corner pieces rounded at 6, so the
      // frame sliced across each corner piece and it read as clipping out of the
      // board. A second radius token is how that regresses, so there must not be
      // one: `puzzle-board.tsx` reads `boardCornerRadius` for the frame's
      // `RoundedRect`, its clip, and `roundPieceCorners` alike.
      const radiusTokens = Object.keys(FX).filter((key) => /cornerradius|radius/i.test(key));
      expect(radiusTokens).toEqual(['boardCornerRadius']);
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
