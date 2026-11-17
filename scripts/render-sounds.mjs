// Synthesizes HabitScape's original sound effects to WAV. No samples, no dependencies:
// every sound is built from sine partials in this file, so we own it outright.
//
//   node scripts/render-sounds.mjs              renders every sound to art/export/sounds/
//   node scripts/render-sounds.mjs --app NAME   also writes NAME as assets/sounds/levelup.wav
//
// Each sound is a short score of note events played by a few simple "instruments".
import { writeFileSync, mkdirSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RATE = 44100;
const TAU = Math.PI * 2;
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const N = name => { // 'C5', 'Bb4', 'F#3' -> midi
  const m = /^([A-G])([b#]?)(-?\d)$/.exec(name);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  return 12 * (Number(m[3]) + 1) + base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
};

// ── Instruments: (out, start, dur, freq, vel) add samples into out ──────────
function brass(out, t0, dur, f, vel) {
  const a = 0.03, r = 0.18, len = Math.floor((dur + r) * RATE), s0 = Math.floor(t0 * RATE);
  for (let i = 0; i < len && s0 + i < out.length; i++) {
    const t = i / RATE;
    const env = t < a ? t / a : t < dur ? 1 - 0.15 * Math.min(1, (t - a) / 0.3) : 0.85 * Math.exp(-(t - dur) / (r / 3));
    const vib = 1 + 0.004 * Math.sin(TAU * 5.2 * t) * Math.min(1, Math.max(0, (t - 0.15) / 0.2));
    let v = 0;
    for (let n = 1; n <= 9; n++) v += Math.sin(TAU * f * n * vib * t) * (1 / n) * env ** (0.4 * n); // brighter when louder
    out[s0 + i] += v * env * vel * 0.22;
  }
}
function bell(out, t0, dur, f, vel) {
  const parts = [[1, 1, 1.4], [2.76, 0.45, 3], [5.4, 0.22, 5], [8.93, 0.1, 8]]; // ratio, amp, decay speed
  const len = Math.floor(Math.max(dur, 1.2) * RATE), s0 = Math.floor(t0 * RATE);
  for (let i = 0; i < len && s0 + i < out.length; i++) {
    const t = i / RATE, atk = Math.min(1, t / 0.002);
    let v = 0;
    for (const [k, amp, d] of parts) v += Math.sin(TAU * f * k * t) * amp * Math.exp(-t * d * 2.2);
    out[s0 + i] += v * atk * vel * 0.18;
  }
}
function pluck(out, t0, dur, f, vel) {
  const len = Math.floor(Math.max(dur, 0.9) * RATE), s0 = Math.floor(t0 * RATE);
  for (let i = 0; i < len && s0 + i < out.length; i++) {
    const t = i / RATE, atk = Math.min(1, t / 0.003);
    const v = Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * 2 * f * t) * Math.exp(-t * 6) + 0.15 * Math.sin(TAU * 3 * f * t) * Math.exp(-t * 10);
    out[s0 + i] += v * atk * Math.exp(-t * 3.5) * vel * 0.2;
  }
}
function drum(out, t0, dur, f, vel) { // soft timpani: falling pitch + a little noise
  const len = Math.floor(0.8 * RATE), s0 = Math.floor(t0 * RATE);
  let phase = 0, seed = 1;
  for (let i = 0; i < len && s0 + i < out.length; i++) {
    const t = i / RATE;
    phase += TAU * f * (1 + 0.5 * Math.exp(-t * 30)) / RATE;
    seed = (seed * 16807) % 2147483647;
    const noise = (seed / 2147483647 - 0.5) * Math.exp(-t * 40);
    out[s0 + i] += (Math.sin(phase) * Math.exp(-t * 4) + noise * 0.3) * Math.min(1, t / 0.004) * vel * 0.5;
  }
}
const VOICES = { brass, bell, pluck, drum };

// ── Scores: [time s, duration s, note, voice, velocity] ──────────────────────
// All original. Keep them short (under 2 s) and ending on a bright major chord.
const chord = (t, d, notes, voice, vel) => notes.map(n => [t, d, n, voice, vel]);
const SOUNDS = {
  // Brass pickup up a C major arpeggio into a held chord, with bells sparkling on top.
  fanfare: [
    [0.00, 0.09, 'G4', 'brass', 0.8], [0.09, 0.09, 'C5', 'brass', 0.85], [0.18, 0.09, 'E5', 'brass', 0.9],
    ...chord(0.30, 0.95, ['C4', 'G4', 'C5', 'E5', 'G5'], 'brass', 0.75),
    [0.30, 0.5, 'C2', 'drum', 0.9],
    [0.34, 0.6, 'C6', 'bell', 0.5], [0.42, 0.6, 'E6', 'bell', 0.45], [0.50, 0.6, 'G6', 'bell', 0.4], [0.58, 0.9, 'C7', 'bell', 0.35],
  ],
  // Bells climb a major pentatonic and bloom into a soft chord. Gentler, more "reward chime".
  chime: [
    [0.00, 0.5, 'C5', 'bell', 0.7], [0.08, 0.5, 'D5', 'bell', 0.7], [0.16, 0.5, 'E5', 'bell', 0.75],
    [0.24, 0.5, 'G5', 'bell', 0.8], [0.32, 0.5, 'A5', 'bell', 0.8], [0.42, 1.2, 'C6', 'bell', 0.95],
    ...chord(0.42, 1.0, ['C4', 'E4', 'G4', 'C5'], 'brass', 0.35),
    ...chord(0.42, 1.0, ['C5', 'E5', 'G5'], 'pluck', 0.5),
  ],
  // In B-flat: a short-short-long call, a suspended chord that resolves, timpani under it.
  quest: [
    [0.00, 0.07, 'F4', 'brass', 0.8], [0.10, 0.07, 'F4', 'brass', 0.8], [0.20, 0.12, 'Bb4', 'brass', 0.9],
    ...chord(0.36, 0.30, ['Bb3', 'F4', 'Bb4', 'Eb5', 'F5'], 'brass', 0.7),
    ...chord(0.66, 0.90, ['Bb3', 'F4', 'Bb4', 'D5', 'F5', 'Bb5'], 'brass', 0.75),
    [0.36, 0.4, 'Bb1', 'drum', 0.7], [0.66, 0.6, 'F2', 'drum', 0.9],
    [0.70, 0.9, 'D6', 'bell', 0.4], [0.80, 0.9, 'F6', 'bell', 0.35], [0.90, 1.0, 'Bb6', 'bell', 0.3],
  ],
};

// ── Mixing ───────────────────────────────────────────────────────────────────
function reverb(dry) { // small room: four feedback combs, 22% wet
  const wet = new Float32Array(dry.length);
  for (const [ms, fb] of [[29.7, 0.72], [37.1, 0.7], [41.1, 0.68], [43.7, 0.66]]) {
    const d = Math.floor(ms / 1000 * RATE), buf = new Float32Array(dry.length);
    for (let i = 0; i < dry.length; i++) { buf[i] = dry[i] + (i >= d ? buf[i - d] * fb : 0); wet[i] += buf[i] * 0.25; }
  }
  return dry.map((v, i) => v * 0.85 + wet[i] * 0.22);
}
function render(score) {
  const end = Math.max(...score.map(([t, d, , v]) => t + d + (v === 'bell' ? 1.2 : 0.4)));
  const len = Math.ceil(Math.min(end, 2.2) * RATE);
  let out = new Float32Array(len);
  for (const [t, d, note, voice, vel] of score) VOICES[voice](out, t, d, hz(N(note)), vel);
  out = reverb(out);
  const fade = Math.floor(0.25 * RATE); // never cut off mid-ring
  for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
  const peak = Math.max(...out.map(Math.abs));
  return out.map(v => (v / peak) * 0.89); // normalize to about -1 dBFS
}
function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const outDir = join(root, 'art', 'export', 'sounds');
mkdirSync(outDir, { recursive: true });
for (const [name, score] of Object.entries(SOUNDS)) {
  writeFileSync(join(outDir, `levelup-${name}.wav`), wav(render(score)));
}
const appIdx = process.argv.indexOf('--app');
if (appIdx > 0) {
  const name = process.argv[appIdx + 1];
  if (!SOUNDS[name]) throw new Error(`Unknown sound "${name}". Options: ${Object.keys(SOUNDS).join(', ')}`);
  writeFileSync(join(root, 'assets', 'sounds', 'levelup.wav'), wav(render(SOUNDS[name])));
  console.log(`assets/sounds/levelup.wav <- ${name}`);
}
console.log(`Rendered ${Object.keys(SOUNDS).length} sounds to ${outDir}`);
