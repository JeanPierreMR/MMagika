// VOICES — the instruments a singer in the signal's choir can be: a bird, or a flute, violin, cello or
// choir "aah", all made in the browser (no recordings).
//
// What starts it:  bird_song.js, once per singer, through makeVoice(name).
// How a voice works: it only makes its SOUND. Its pitch is steered from outside, through two controls
//                  it hands back, so every voice can sing the same choir parts, glides and timings:
//                    pitch    the note, in hertz (bird_song.js moves it from note to note)
//                    detune   small changes in cents (vibrato, the pitch drifting, slightly out of tune)
//                  and "output", where its sound comes out (bird_song.js shapes its loudness from there).
// Which voices exist, and their name in the lab's dropdown: VOICES below. How each one is sung (its range,
// how it starts a note, its vibrato) is in VOICE_STYLES at the top of chapters/signal/bird_song.js.
// To add one: write a maker below, add it to VOICES, and give it a style in bird_song.js.

import { noiseSource } from "./synth_recipes.js";

// ---- Building blocks -----------------------------------------------------------------------------

// A note-following oscillator: its pitch and detune come from the shared controls.
function follower(audio, controls, type, cents = 0) {
  const oscillator = audio.createOscillator();
  oscillator.type = type;
  oscillator.frequency.value = 0;              // all of its pitch comes from controls.pitch
  oscillator.detune.value = cents;
  controls.pitch.connect(oscillator.frequency);
  controls.detune.connect(oscillator.detune);
  controls.sources.push(oscillator);
  return oscillator;
}

// Breath or bow noise, filtered around the note being played.
function noiseAroundTheNote(audio, controls, sharpness, level, seed) {
  const noise = noiseSource(audio, 3, seed);
  noise.loop = true;
  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 0;                     // follows the note
  band.Q.value = sharpness;
  controls.pitch.connect(band.frequency);
  const amount = audio.createGain();
  amount.gain.value = level;
  noise.connect(band).connect(amount);
  controls.sources.push(noise);
  return amount;
}

// A filter that lifts (or cuts) one band of frequencies: the "body" of an instrument.
function resonance(audio, frequency, gainDb, q = 1.2) {
  const peak = audio.createBiquadFilter();
  peak.type = "peaking";
  peak.frequency.value = frequency;
  peak.gain.value = gainDb;
  peak.Q.value = q;
  return peak;
}

// The shape that adds a faint second harmonic to a pure tone: x + amount·(2x² − 1).
const overtoneCurves = new Map();
function overtone(audio, amount) {
  if (!overtoneCurves.has(amount)) {
    const curve = new Float32Array(1025);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = (x + amount * (2 * x * x - 1)) / (1 + amount);
    }
    overtoneCurves.set(amount, curve);
  }
  const shaper = audio.createWaveShaper();
  shaper.curve = overtoneCurves.get(amount);
  return shaper;
}

// ---- The voices -------------------------------------------------------------------------------------

// A bird: a nearly pure whistle with a faint overtone and a breath of air.
function bird(audio, controls, output) {
  follower(audio, controls, "sine").connect(overtone(audio, 0.12)).connect(output);
  noiseAroundTheNote(audio, controls, 6, 0.12, 121).connect(output);
}

// A flute: a soft, round tone with a little second harmonic and plenty of breath.
function flute(audio, controls, output) {
  follower(audio, controls, "sine").connect(overtone(audio, 0.22)).connect(output);
  noiseAroundTheNote(audio, controls, 3, 0.3, 131).connect(output);
}

// A bowed string (violin or cello): two slightly different bright tones through the wooden body's
// resonances, with a little bow noise. "body" lists the resonances: [hertz, lift in dB].
function bowed(body, brightness) {
  return (audio, controls, output) => {
    const strings = audio.createGain();
    strings.gain.value = 0.3;
    follower(audio, controls, "sawtooth", -4).connect(strings);
    follower(audio, controls, "sawtooth", 4).connect(strings);
    let chain = strings;
    for (const [frequency, gainDb] of body) chain = chain.connect(resonance(audio, frequency, gainDb));
    const tone = audio.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = brightness;
    chain.connect(tone).connect(output);
    noiseAroundTheNote(audio, controls, 2, 0.05, 141).connect(output);
  };
}

// A choir singing "aah": two slightly different voices through the resonances of an open "aah" vowel.
function aah(audio, controls, output) {
  const throat = audio.createGain();
  throat.gain.value = 0.9;
  follower(audio, controls, "sawtooth", -7).connect(throat);
  follower(audio, controls, "sawtooth", 7).connect(throat);
  for (const [frequency, q, strength] of [[800, 6, 1], [1150, 8, 0.5], [2900, 10, 0.25]]) {
    const vowel = audio.createBiquadFilter();
    vowel.type = "bandpass";
    vowel.frequency.value = frequency;
    vowel.Q.value = q;
    const amount = audio.createGain();
    amount.gain.value = strength;
    throat.connect(vowel).connect(amount).connect(output);
  }
}

// Every voice, by the name used in settings and in the lab's dropdown, with a label for people.
// "level" evens out their loudness, so switching voices doesn't change how loud the choir is.
export const VOICES = {
  bird: { label: "bird", make: bird, level: 1 },
  flute: { label: "flute", make: flute, level: 1.05 },
  violin: { label: "violin", make: bowed([[280, 6], [1000, 4], [2600, 5]], 5000), level: 2 },
  cello: { label: "cello", make: bowed([[120, 6], [400, 4], [1200, 4]], 3200), level: 2.1 },
  aah: { label: "choir \"aah\"", make: aah, level: 3.7 },
};

// Make one singer's voice. Returns { pitch, detune, output, sources }: set pitch.offset (hertz) and
// detune.offset (cents) like any setting; start and stop every node in "sources".
export function makeVoice(audio, name) {
  const controls = { pitch: audio.createConstantSource(), detune: audio.createConstantSource(), sources: [] };
  controls.pitch.offset.value = 440;
  controls.detune.offset.value = 0;
  controls.sources.push(controls.pitch, controls.detune);
  const voice = VOICES[name] ?? VOICES.bird;
  const output = audio.createGain();
  output.gain.value = voice.level;
  voice.make(audio, controls, output);
  return { pitch: controls.pitch, detune: controls.detune, output, sources: controls.sources };
}
