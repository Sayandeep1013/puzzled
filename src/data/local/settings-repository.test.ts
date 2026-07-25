import { DEFAULT_SETTINGS, mergeSettings, parseSettingsRows } from './settings-repository';

describe('mergeSettings', () => {
  it('overlays a patch onto current values', () => {
    expect(mergeSettings({ sound: true, music: true, haptics: true }, { music: false })).toEqual({
      sound: true,
      music: false,
      haptics: true,
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

  it('defaults every toggle to on', () => {
    expect(DEFAULT_SETTINGS).toEqual({ sound: true, music: true, haptics: true });
  });
});
