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

  describe('bevel', () => {
    it('lights from the top-left and shades the opposite corner', () => {
      // A single offset drives both rims in opposite directions, so one positive
      // number is all that keeps the emboss physically consistent.
      expect(FX.bevel.offset).toBeGreaterThan(0);
      expect(FX.bevel.blur).toBeGreaterThan(0);
    });

    it('keeps rims strong enough to read as depth but short of opaque', () => {
      // The first pass used 0.38/0.32, which was technically an emboss but too
      // faint to see on a device. The floor here is what stops it drifting back;
      // the ceiling keeps the artwork visible underneath.
      for (const value of [FX.bevel.light, FX.bevel.shade]) {
        const alpha = Number(value.match(/,\s*([\d.]+)\)$/)?.[1]);
        expect(alpha).toBeGreaterThanOrEqual(0.5);
        expect(alpha).toBeLessThan(1);
      }
    });
  });

  describe('piece corners', () => {
    it('rounds the silhouette so unplaced border pieces are not sharp', () => {
      expect(FX.pieceCornerRadius).toBeGreaterThan(0);
    });
  });

  describe('loose outline', () => {
    it('is a faint green hairline rather than an orange ring', () => {
      const match = FX.looseOutline.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      expect(match).not.toBeNull();
      const [r, g, b] = match!.slice(1, 4).map(Number);
      expect(g).toBeGreaterThan(r);
      expect(g).toBeGreaterThan(b);

      const alpha = Number(FX.looseOutline.color.match(/,\s*([\d.]+)\)$/)?.[1]);
      expect(alpha).toBeLessThanOrEqual(0.5);
      expect(FX.looseOutline.strokeWidth).toBeLessThanOrEqual(1.5);
    });
  });
});
