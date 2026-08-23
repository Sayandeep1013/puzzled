import { DEFAULT_SETTINGS, mergeSettings, parseSettingsRows } from './settings-repository';

describe('mergeSettings', () => {
  it('overlays a patch onto current values', () => {
    expect(mergeSettings(DEFAULT_SETTINGS, { music: false })).toEqual({
      ...DEFAULT_SETTINGS,
      music: false,
    });
  });

  it('overlays a non-boolean setting too', () => {
    expect(mergeSettings(DEFAULT_SETTINGS, { themeId: 'wood' })).toEqual({
      ...DEFAULT_SETTINGS,
      themeId: 'wood',
    });
  });

  it('ignores undefined patch entries rather than writing them as false', () => {
    expect(mergeSettings(DEFAULT_SETTINGS, { sound: undefined })).toEqual(DEFAULT_SETTINGS);
  });
});

describe('parseSettingsRows', () => {
  it('falls back to defaults for missing keys', () => {
    expect(parseSettingsRows([{ key: 'sound', value: '0' }])).toEqual({
      ...DEFAULT_SETTINGS,
      sound: false,
    });
  });

  it('ignores unknown keys left by an older build', () => {
    expect(parseSettingsRows([{ key: 'gravity', value: '1' }])).toEqual(DEFAULT_SETTINGS);
  });

  it('defaults every toggle to on, and the theme to the one that ships', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      sound: true,
      music: true,
      haptics: true,
      showGrid: true,
      snapAssist: true,
      themeId: 'meadow',
    });
  });

  it('reads a string setting as its own text, not as a boolean', () => {
    // Every setting was a boolean until the theme arrived, and the parser read
    // `value === '1'` for all of them — which would have turned every theme id
    // into `false`.
    expect(parseSettingsRows([{ key: 'themeId', value: 'wood' }]).themeId).toBe('wood');
  });
});
