import { accentAt, accentRamp, backgrounds, colors, radii, shadow } from './tokens';

describe('accentAt', () => {
  it('cycles through the ramp', () => {
    expect(accentAt(0)).toBe(accentRamp[0]);
    expect(accentAt(accentRamp.length)).toBe(accentRamp[0]);
    expect(accentAt(1)).toBe(accentRamp[1]);
  });

  it('handles negative indices without throwing', () => {
    expect(accentAt(-1)).toBe(accentRamp[accentRamp.length - 1]);
  });

  it('never returns the same colour for adjacent indices', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(accentAt(i)).not.toBe(accentAt(i + 1));
    }
  });
});

describe('tokens', () => {
  it('has no sharp corners', () => {
    for (const value of Object.values(radii)) {
      expect(value).toBeGreaterThanOrEqual(14);
    }
  });

  it('uses warm brown ink rather than black, so it sits on cream', () => {
    expect(colors.ink).toBe('#3A2B1A');
    expect(colors.ink).not.toBe('#000000');
  });

  it('gives every shadow a blur radius', () => {
    // The inverse of Chunky Pop's guard: that direction required blur 0, this
    // one requires blur. A zero-blur value here means a token was carried over.
    for (const [name, value] of Object.entries(shadow)) {
      const blurs = [...value.matchAll(/-?\d+(?:\.\d+)?px/g)].map((m) => m[0]);
      // Each layer is "offsetX offsetY blur spread"; at least one layer must blur.
      const hasBlur = value.split(',').some((layer) => {
        const parts = [...layer.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
        return parts.length >= 3 && parts[2] > 0;
      });
      expect(blurs.length).toBeGreaterThan(0);
      expect(hasBlur).toBe(true);
      expect(name).toBeTruthy();
    }
  });

  it('exposes a background tint for every screen family', () => {
    expect(Object.keys(backgrounds)).toEqual(
      expect.arrayContaining(['homeSky', 'homeGrass', 'game', 'results', 'pack', 'default']),
    );
  });
});
