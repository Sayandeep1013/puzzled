import { accentAt, accentRamp, colors, radii } from './tokens';

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

  it('uses near-black ink rather than pure black', () => {
    expect(colors.ink).toBe('#141414');
  });
});
