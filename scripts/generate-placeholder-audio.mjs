#!/usr/bin/env node
/**
 * Synthesises the board's placeholder SFX + ambient loop as plain 16-bit mono
 * 44.1kHz WAV files — no npm packages, no downloaded audio. Every clip is
 * built from scratch (sine oscillators + a little noise) and written with a
 * hand-rolled RIFF/WAVE header, so the assets in `assets/audio/` are fully
 * reproducible from this one script.
 *
 * These are GENERATED PLACEHOLDERS, not final audio — see
 * `assets/audio/README.md`.
 *
 * Run: node scripts/generate-placeholder-audio.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 44100;
const FADE_SECONDS = 0.005; // 5ms edge fade so no clip clicks on play/stop.
const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'audio');

// ---------------------------------------------------------------------------
// WAV encoding — a 44-byte RIFF/WAVE/fmt/data header followed by raw 16-bit
// little-endian PCM samples. Built on a DataView (not Buffer) so the script
// has zero Node-global surface beyond the explicit fs/path/url imports.
// ---------------------------------------------------------------------------

function writeAsciiChars(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/** Encode Float32 samples in [-1, 1] as a 16-bit mono PCM WAV byte buffer. */
function encodeWav(samples, sampleRate = SAMPLE_RATE) {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const byteRate = sampleRate * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAsciiChars(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAsciiChars(view, 8, 'WAVE');
  writeAsciiChars(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size (PCM)
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, 1, true); // channels = mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAsciiChars(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, Math.round(clamped * 32767), true);
    offset += bytesPerSample;
  }

  return new Uint8Array(buffer);
}

// ---------------------------------------------------------------------------
// Sample-buffer helpers shared by every clip.
// ---------------------------------------------------------------------------

function samplesForMs(durationMs, sampleRate = SAMPLE_RATE) {
  return Math.round((durationMs / 1000) * sampleRate);
}

/** Scale the loudest sample to `target` peak so clips share a comfortable level. */
function normalizePeak(samples, target = 0.9) {
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  if (peak > 0) {
    const scale = target / peak;
    for (let i = 0; i < samples.length; i += 1) {
      samples[i] *= scale;
    }
  }
  return samples;
}

/** In-place 5ms linear fade in/out so a clip never clicks at its edges. */
function applyEdgeFades(samples, sampleRate = SAMPLE_RATE) {
  const fadeSamples = Math.min(
    Math.floor(FADE_SECONDS * sampleRate),
    Math.floor(samples.length / 2),
  );
  for (let i = 0; i < fadeSamples; i += 1) {
    const gain = i / fadeSamples;
    samples[i] *= gain;
    samples[samples.length - 1 - i] *= gain;
  }
  return samples;
}

function finalizeClip(samples) {
  normalizePeak(samples);
  applyEdgeFades(samples);
  return samples;
}

// ---------------------------------------------------------------------------
// Clip generators
// ---------------------------------------------------------------------------

/** pickup.wav — 90ms, 660Hz sine, fast exponential decay (piece lifted). */
function makePickup() {
  const n = samplesForMs(90);
  const freq = 660;
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    const envelope = Math.exp(-t * 34);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * envelope;
  }
  return finalizeClip(samples);
}

/** snap.wav — 140ms, 440->880Hz rising sine plus a short noise transient (piece locks). */
function makeSnap() {
  const durationMs = 140;
  const durationSec = durationMs / 1000;
  const n = samplesForMs(durationMs);
  const f0 = 440;
  const f1 = 880;
  const noiseDurationSec = 0.015;
  const samples = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    const tt = t / durationSec; // 0..1 across the clip
    const freq = f0 + (f1 - f0) * tt;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const toneEnvelope = Math.pow(1 - tt, 0.7);
    let sample = Math.sin(phase) * toneEnvelope * 0.85;
    if (t < noiseDurationSec) {
      const noiseEnvelope = Math.exp(-t * 220);
      sample += (Math.random() * 2 - 1) * noiseEnvelope * 0.5;
    }
    samples[i] = sample;
  }
  return finalizeClip(samples);
}

/** complete.wav — 700ms arpeggio across 523/659/784/1047Hz, 175ms per note. */
function makeComplete() {
  const noteFreqs = [523, 659, 784, 1047];
  const noteMs = 175;
  const noteSamples = samplesForMs(noteMs);
  const noteDurationSec = noteSamples / SAMPLE_RATE;
  const attackSec = 0.008;
  const samples = new Float32Array(noteSamples * noteFreqs.length);

  noteFreqs.forEach((freq, noteIndex) => {
    const base = noteIndex * noteSamples;
    for (let i = 0; i < noteSamples; i += 1) {
      const t = i / SAMPLE_RATE;
      let envelope;
      if (t < attackSec) {
        envelope = t / attackSec;
      } else {
        const decayT = (t - attackSec) / (noteDurationSec - attackSec);
        envelope = Math.exp(-4.5 * decayT);
      }
      samples[base + i] = Math.sin(2 * Math.PI * freq * t) * envelope;
    }
  });

  return finalizeClip(samples);
}

/** tap.wav — 60ms, 880Hz sine, very fast decay (light UI tap). */
function makeTap() {
  const n = samplesForMs(60);
  const freq = 880;
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    const envelope = Math.exp(-t * 60);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * envelope;
  }
  return finalizeClip(samples);
}

/**
 * ambient.wav — 4s loop, two detuned sines (220Hz / 220.5Hz) with a slow
 * amplitude swell. Both tone frequencies and the swell rate complete a whole
 * number of cycles across the 4s window (880 / 882 / 2 cycles respectively),
 * so the raw waveform's phase is already loop-safe before the edge fades are
 * applied.
 */
function makeAmbient() {
  const durationSec = 4;
  const n = samplesForMs(durationSec * 1000);
  const f1 = 220;
  const f2 = 220.5;
  const swellHz = 0.5;
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    const swell = 0.35 + 0.25 * (0.5 - 0.5 * Math.cos(2 * Math.PI * swellHz * t));
    const tone = Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t);
    samples[i] = tone * 0.5 * swell;
  }
  return finalizeClip(samples);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const CLIPS = [
  { file: 'pickup.wav', generate: makePickup },
  { file: 'snap.wav', generate: makeSnap },
  { file: 'complete.wav', generate: makeComplete },
  { file: 'tap.wav', generate: makeTap },
  { file: 'ambient.wav', generate: makeAmbient },
];

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const clip of CLIPS) {
    const samples = clip.generate();
    const bytes = encodeWav(samples);
    const outPath = join(OUTPUT_DIR, clip.file);
    writeFileSync(outPath, bytes);
    const durationMs = Math.round((samples.length / SAMPLE_RATE) * 1000);
    console.log(`wrote ${clip.file} — ${durationMs}ms, ${bytes.length} bytes`);
  }
}

main();
