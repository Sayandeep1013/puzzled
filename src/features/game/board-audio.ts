import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import type { AppSettings } from '@/data';

/**
 * Board SFX + ambient music, built on expo-audio's player API
 * (https://docs.expo.dev/versions/v57.0.0/sdk/audio/ — `createAudioPlayer`,
 * `player.play()`/`.seekTo()`/`.remove()`; expo-audio replaced expo-av in
 * SDK 54+ and has a different player-object API).
 *
 * Players are module-level singletons created once per app process and
 * reused across every board mount/restart — `initBoardAudio` is safe to call
 * repeatedly. Every exported call here is fire-and-forget and must never
 * throw: a failed play must not interrupt a drag.
 */

export type SfxName = 'pickup' | 'snap' | 'complete' | 'tap';

// Metro resolves `require` of local assets to a numeric module id at bundle
// time (same pattern as `src/data/local/puzzle-assets.ts` for images).
const SFX_SOURCES: Record<SfxName, number> = {
  pickup: require('../../../assets/audio/pickup.wav'),
  snap: require('../../../assets/audio/snap.wav'),
  complete: require('../../../assets/audio/complete.wav'),
  tap: require('../../../assets/audio/tap.wav'),
};

const AMBIENT_SOURCE: number = require('../../../assets/audio/ambient.wav');
const AMBIENT_VOLUME = 0.35;

const sfxPlayers: Partial<Record<SfxName, AudioPlayer>> = {};
let ambientPlayer: AudioPlayer | null = null;
let sfxEnabled = true;
let musicEnabled = true;
let loadPromise: Promise<void> | null = null;

/** Create every player exactly once; cheap to call again on a later board mount. */
function ensurePlayersLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      // Best-effort: let short SFX play even with the iOS silent switch on.
      await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});

      (Object.keys(SFX_SOURCES) as SfxName[]).forEach((name) => {
        if (!sfxPlayers[name]) {
          sfxPlayers[name] = createAudioPlayer(SFX_SOURCES[name]);
        }
      });

      if (!ambientPlayer) {
        ambientPlayer = createAudioPlayer(AMBIENT_SOURCE);
        ambientPlayer.loop = true;
        ambientPlayer.volume = AMBIENT_VOLUME;
      }
    })().catch(() => {
      // A failed load must not wedge future attempts; let the next call retry.
      loadPromise = null;
    });
  }
  return loadPromise;
}

/** Start/stop the ambient loop to match the current `musicEnabled` flag. */
function applyMusicState(): void {
  if (!ambientPlayer) {
    return;
  }
  try {
    if (musicEnabled) {
      if (!ambientPlayer.playing) {
        ambientPlayer.play();
      }
    } else if (ambientPlayer.playing) {
      ambientPlayer.pause();
    }
  } catch {
    // Best-effort only — a stuck ambient loop is not worth surfacing.
  }
}

/**
 * Preload the SFX + ambient players and apply `settings.sound`/`settings.music`.
 * Safe to await from a board's mount effect; never throws.
 */
export async function initBoardAudio(settings: AppSettings): Promise<void> {
  sfxEnabled = settings.sound;
  musicEnabled = settings.music;
  try {
    await ensurePlayersLoaded();
    applyMusicState();
  } catch {
    // Audio is best-effort; a failed init must not block the board.
  }
}

/** Fire-and-forget one-shot SFX playback, gated on the sound setting. Never throws. */
export function playSfx(name: SfxName): void {
  if (!sfxEnabled) {
    return;
  }
  const player = sfxPlayers[name];
  if (!player) {
    return;
  }
  try {
    // Rewind so a rapid re-trigger (e.g. quick successive snaps) restarts
    // the clip instead of doing nothing; the seek is fire-and-forget too.
    player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // A failed play must never interrupt a drag.
  }
}

/** Toggle the ambient loop. Called by the pause-menu Music switch (Task 14). */
export function setMusicEnabled(on: boolean): void {
  musicEnabled = on;
  applyMusicState();
}

/** Gate future `playSfx` calls. Called by the pause-menu Sound switch (Task 14). */
export function setSfxEnabled(on: boolean): void {
  sfxEnabled = on;
}

/**
 * Pause (not remove) the ambient loop without touching the persisted music
 * setting — used when the board unmounts so leaving the puzzle screen
 * doesn't leave the loop playing forever. Never throws.
 */
export function pauseBoardAudio(): void {
  try {
    ambientPlayer?.pause();
  } catch {
    // Best-effort only.
  }
}
