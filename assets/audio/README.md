# Board audio — generated placeholders

Every `.wav` file in this folder is a **synthesized placeholder**, not final
audio. They exist so the board (`src/features/game/puzzle-board.tsx`) has
something to play while real sound design is pending — replace them wholesale
once final assets exist.

Regenerate at any time with:

```
node scripts/generate-placeholder-audio.mjs
```

The script has no dependencies: it writes raw 16-bit mono 44.1kHz PCM samples
(sine tones + a little noise) with a hand-rolled RIFF/WAVE header, so every
file here is fully reproducible from source.

| File | Character |
| --- | --- |
| `pickup.wav` | 90ms, 660Hz sine, fast exponential decay — piece lifted |
| `snap.wav` | 140ms, 440→880Hz rising sine + short noise transient — piece locks |
| `complete.wav` | ~700ms, arpeggio across 523/659/784/1047Hz — puzzle finished |
| `tap.wav` | 60ms, 880Hz sine, very fast decay — light UI tap (reserved for future UI use) |
| `ambient.wav` | 4s seamless loop, two detuned sines (220Hz / 220.5Hz) with a slow amplitude swell |

All clips have a 5ms linear fade in/out so playback never clicks.
