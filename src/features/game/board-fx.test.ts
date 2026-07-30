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

    it('uses translucent rims so the artwork still reads through', () => {
      for (const value of [FX.bevel.light, FX.bevel.shade]) {
        const alpha = Number(value.match(/,\s*([\d.]+)\)$/)?.[1]);
        expect(alpha).toBeGreaterThan(0);
        expect(alpha).toBeLessThan(0.5);
      }
    });
  });
});
