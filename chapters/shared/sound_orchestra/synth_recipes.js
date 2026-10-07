// SYNTH RECIPES — every sound the site can make by itself, built in the browser (Web Audio API),
// so the experience has sound even before any audio file is added.
//
// What starts it:  orchestra.js, when a cue in sound_book.js names one of these recipes ("synth").
// How a recipe works: recipe(audio, out, options) builds its sound and plays it into `out` (the
//                  cue's own volume control), starting at options.when. It gives back
//                    { length }  for a one-off sound: how many seconds it lasts;
//                    { stop(at) } for a bed (a sound that keeps going until it's stopped).
// Loudness:        each recipe is made at a comfortable level; the cue's "volume" in sound_book.js
//                  scales it. Change a recipe here to change how a placeholder sounds.
// Noise:           all noise and "random" choices come from looks_random.js, so every sound is
//                  the same on every visit.

import { makeRandom } from "../looks_random.js";

const SILENT = 0.0001;          // "silence" for fades (fading to exactly 0 isn't allowed)

// ---- Building blocks ---------------------------------------------------------------------------

// A buffer of white noise (made once, then reused).
const noiseBuffers = new Map();
export function noiseSource(audio, seconds = 2, seed = 1) {
  const key = `${seconds}:${seed}:${audio.sampleRate}`;
  if (!noiseBuffers.has(key)) {
    const random = makeRandom(seed);
    const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * seconds), audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1;
    noiseBuffers.set(key, buffer);
  }
  const source = audio.createBufferSource();
  source.buffer = noiseBuffers.get(key);
  return source;
}

function makeFilter(audio, type, frequency, q = 1) {
  const filter = audio.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  return filter;
}

function makeGain(audio, value) {
  const gain = audio.createGain();
  gain.gain.value = value;
  return gain;
}

// A slow (or fast) wobble: an oscillator through a gain, ready to connect to any setting.
function makeWobble(audio, rate, depth, type = "sine") {
  const oscillator = audio.createOscillator();
  oscillator.type = type;
  oscillator.frequency.value = rate;
  const amount = makeGain(audio, depth);
  oscillator.connect(amount);
  return { oscillator, amount };
}

// A reverb, like a large room: a burst of noise that dies away, used as the room's "echo shape".
const hallShapes = new Map();
function makeHall(audio, seconds = 3, seed = 9) {
  const key = `${seconds}:${seed}:${audio.sampleRate}`;
  if (!hallShapes.has(key)) {
    const random = makeRandom(seed);
    const length = Math.ceil(audio.sampleRate * seconds);
    const buffer = audio.createBuffer(2, length, audio.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (random() * 2 - 1) * (1 - i / length) ** 3;
    }
    hallShapes.set(key, buffer);
  }
  const hall = audio.createConvolver();
  hall.buffer = hallShapes.get(key);
  return hall;
}

// A short burst of noise, shaped by a filter and faded out.
function noiseBurst(audio, out, { when, duration, volume, type, frequency, q = 1, seed = 1 }) {
  const source = noiseSource(audio, duration + 0.05, seed);
  const loudness = makeGain(audio, SILENT);
  loudness.gain.setValueAtTime(volume, when);
  loudness.gain.exponentialRampToValueAtTime(SILENT, when + duration);
  source.connect(makeFilter(audio, type, frequency, q)).connect(loudness).connect(out);
  source.start(when);
  source.stop(when + duration + 0.05);
}

// A short tone that fades out (pitch in hertz), optionally sliding to another pitch.
function tone(audio, out, { when, pitch, duration, volume, wave = "sine", slideTo = null, attack = 0.01 }) {
  const oscillator = audio.createOscillator();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(pitch, when);
  if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, when + duration);
  const loudness = makeGain(audio, SILENT);
  loudness.gain.setValueAtTime(SILENT, when);
  loudness.gain.exponentialRampToValueAtTime(volume, when + attack);
  loudness.gain.exponentialRampToValueAtTime(SILENT, when + duration);
  oscillator.connect(loudness).connect(out);
  oscillator.start(when);
  oscillator.stop(when + duration + 0.05);
}

// Starts the given oscillators/sources now and returns a "stop" for a bed.
function keepGoing(audio, sources, extraStop = () => {}) {
  sources.forEach((source) => source.start());
  return {
    stop(at = audio.currentTime) {
      extraStop();
      sources.forEach((source) => { try { source.stop(at); } catch { /* already stopped */ } });
    },
  };
}

// Runs `step` every so often while the sound system is running (it pauses with it).
function every(audio, ms, step) {
  const timer = setInterval(() => { if (audio.state === "running") step(); }, ms);
  return () => clearInterval(timer);
}

// ---- The vault ---------------------------------------------------------------------------------

// A dial clicking into place.
export function tick(audio, out, { when }) {
  noiseBurst(audio, out, { when, duration: 0.03, volume: 0.2, type: "bandpass", frequency: 2600, q: 3, seed: 11 });
  return { length: 0.05 };
}

// A wrong combination: the door is pulled, the heavy metal scrapes a moment and hits its stop with a
// low clank that rings on in the empty room (a large reverb). The clank's ring is a few metal-like
// partials (not whole-number multiples, so it sounds like struck steel, not a musical note).
export function clank(audio, out, { when }) {
  const hall = makeHall(audio, 3.2, 13);
  hall.connect(makeGain(audio, 0.9)).connect(out);
  const room = makeFilter(audio, "lowpass", 1600, 0.7);       // heavy metal, muffled by the door
  room.connect(out);
  room.connect(hall);
  const hit = when + 0.16;                                    // after the short scrape

  noiseBurst(audio, room, { when, duration: 0.16, volume: 0.05, type: "bandpass", frequency: 500, q: 3, seed: 12 });   // the scrape
  tone(audio, room, { when: hit, pitch: 62, duration: 0.45, volume: 0.45, slideTo: 44, attack: 0.004 });               // the thud
  for (const [pitch, volume, ring] of [[118, 0.12, 1.4], [287, 0.06, 1.0], [463, 0.035, 0.8], [771, 0.02, 0.6]]) {
    tone(audio, room, { when: hit, pitch, duration: ring, volume, wave: "triangle", attack: 0.003 });                  // the metal ringing
  }
  noiseBurst(audio, room, { when: hit, duration: 0.07, volume: 0.25, type: "lowpass", frequency: 900, seed: 14 });     // the impact
  return { length: 3.5 };
}

// The vault opens: the oxidized door cracks free (rust snapping and crunching, a low groan of metal),
// then air rushes out with a long WHOOSH as the light floods the view, fading into the white
// (timings match vault.css "Opening"). Change the numbers below to reshape it.
const CRACKS = { from: 0.1, to: 2.0, count: 34 };      // seconds: the rust cracking, and how many cracks
const GROAN = { from: 0.4, to: 2.4, pitch: [210, 150] }; // the door's low metal groan: when, and its slide (Hz)
const WHOOSH = { from: 1.4, peak: 2.7, to: 4.6, sweep: [250, 3800] };   // the air rushing out: when, and its sweep (Hz)

export function vaultOpen(audio, out, { when }) {
  const hall = makeHall(audio, 3.5, 21);
  hall.connect(makeGain(audio, 0.6)).connect(out);
  const random = makeRandom(27);

  // A couple of heavy clunks as it gives (the bolts).
  for (const [at, pitch] of [[0, 85], [0.35, 70]]) {
    tone(audio, out, { when: when + at, pitch, duration: 0.3, volume: 0.28, wave: "triangle", slideTo: 50 });
    noiseBurst(audio, out, { when: when + at, duration: 0.15, volume: 0.2, type: "lowpass", frequency: 700, seed: 20 });
  }

  // The rust cracking: short snaps of crunchy noise, thicker in the middle, some with a tiny metallic ping.
  for (let i = 0; i < CRACKS.count; i++) {
    const share = random();
    const at = when + CRACKS.from + (CRACKS.to - CRACKS.from) * (0.5 + (share - 0.5) * Math.abs(share * 2 - 1));
    const size = 0.008 + random() * 0.035;
    const snap = makeGain(audio, 1);
    snap.connect(out);
    snap.connect(hall);
    noiseBurst(audio, snap, { when: at, duration: size, volume: 0.12 + random() * 0.22, type: "bandpass",
      frequency: 900 + random() * 3800, q: 1.5 + random() * 4, seed: 300 + i });
    if (random() < 0.3) tone(audio, snap, { when: at, pitch: 1200 + random() * 2400, duration: 0.05 + random() * 0.08, volume: 0.02, wave: "triangle", attack: 0.002 });
  }

  // The low groan of the metal: a narrow, resonant band of noise sliding slowly down.
  const groan = noiseSource(audio, 3, 28);
  const groanBand = makeFilter(audio, "bandpass", GROAN.pitch[0], 14);
  groanBand.frequency.setValueAtTime(GROAN.pitch[0], when + GROAN.from);
  groanBand.frequency.exponentialRampToValueAtTime(GROAN.pitch[1], when + GROAN.to);
  const groanLevel = makeGain(audio, SILENT);
  groanLevel.gain.setValueAtTime(SILENT, when + GROAN.from);
  groanLevel.gain.exponentialRampToValueAtTime(0.5, when + GROAN.from + 0.4);
  groanLevel.gain.exponentialRampToValueAtTime(SILENT, when + GROAN.to);
  groan.connect(groanBand).connect(groanLevel);
  groanLevel.connect(out);
  groanLevel.connect(hall);
  groan.start(when + GROAN.from);
  groan.stop(when + GROAN.to + 0.1);

  // The whoosh: air rushing out, a wide band of noise sweeping up, swelling and fading into the white,
  // moving from one side to the other.
  const air = noiseSource(audio, 5, 29);
  const airBand = makeFilter(audio, "bandpass", WHOOSH.sweep[0], 0.8);
  airBand.frequency.setValueAtTime(WHOOSH.sweep[0], when + WHOOSH.from);
  airBand.frequency.exponentialRampToValueAtTime(WHOOSH.sweep[1], when + WHOOSH.to);
  const airLevel = makeGain(audio, SILENT);
  airLevel.gain.setValueAtTime(SILENT, when + WHOOSH.from);
  airLevel.gain.exponentialRampToValueAtTime(0.35, when + WHOOSH.peak);
  airLevel.gain.exponentialRampToValueAtTime(SILENT, when + WHOOSH.to);
  const side = audio.createStereoPanner ? audio.createStereoPanner() : makeGain(audio, 1);
  if (side.pan) {
    side.pan.setValueAtTime(-0.6, when + WHOOSH.from);
    side.pan.linearRampToValueAtTime(0.5, when + WHOOSH.to);
  }
  air.connect(airBand).connect(airLevel).connect(side);
  side.connect(out);
  side.connect(hall);
  air.start(when + WHOOSH.from);
  air.stop(when + WHOOSH.to + 0.1);

  // Under it all, a soft deep swell as the light pours out.
  const swell = audio.createOscillator();
  swell.frequency.setValueAtTime(48, when + 1.4);
  swell.frequency.exponentialRampToValueAtTime(96, when + 3.6);
  const swellLevel = makeGain(audio, SILENT);
  swellLevel.gain.setValueAtTime(SILENT, when + 1.4);
  swellLevel.gain.exponentialRampToValueAtTime(0.18, when + 2.8);
  swellLevel.gain.exponentialRampToValueAtTime(SILENT, when + 4.4);
  swell.connect(swellLevel).connect(hall);
  swell.start(when + 1.4);
  swell.stop(when + 4.5);
  return { length: 5.5 };
}

// The vault's room, before it opens: a low drone with wind moving through concrete.
export function roomBed(audio, out) {
  const drone = audio.createOscillator();
  drone.frequency.value = 55;
  const droneLevel = makeGain(audio, 0.35);
  const fifth = audio.createOscillator();
  fifth.frequency.value = 82.4;
  const fifthLevel = makeGain(audio, 0.12);
  const breathing = makeWobble(audio, 0.05, 0.1);
  breathing.amount.connect(droneLevel.gain);
  drone.connect(droneLevel).connect(out);
  fifth.connect(fifthLevel).connect(out);

  const wind = noiseSource(audio, 6, 31);
  wind.loop = true;
  const windFilter = makeFilter(audio, "lowpass", 350, 0.8);
  const gusts = makeWobble(audio, 0.07, 220);
  gusts.amount.connect(windFilter.frequency);
  wind.connect(windFilter).connect(makeGain(audio, 0.5)).connect(out);

  return keepGoing(audio, [drone, fifth, breathing.oscillator, wind, gusts.oscillator]);
}

// ---- The signal --------------------------------------------------------------------------------

// The forest at dawn: wind in the leaves, a rustle, and now and then a faint, distant bird.
export function forestBed(audio, out) {
  const leaves = noiseSource(audio, 6, 41);
  leaves.loop = true;
  const leavesLevel = makeGain(audio, 0.35);
  const gusts = makeWobble(audio, 0.09, 0.22);
  gusts.amount.connect(leavesLevel.gain);
  leaves.connect(makeFilter(audio, "bandpass", 1300, 0.6)).connect(leavesLevel).connect(out);

  const rustle = noiseSource(audio, 5, 42);
  rustle.loop = true;
  const rustleLevel = makeGain(audio, 0.06);
  const rustleWobble = makeWobble(audio, 0.23, 0.05);
  rustleWobble.amount.connect(rustleLevel.gain);
  rustle.connect(makeFilter(audio, "highpass", 5000, 0.7)).connect(rustleLevel).connect(out);

  // Distant birds: far away (muffled, with room around them), from a different side each time.
  const distance = makeFilter(audio, "lowpass", 5500, 0.7);
  const hall = makeHall(audio, 2.5, 43);
  const farAway = makeGain(audio, 0.5);
  distance.connect(farAway).connect(out);
  distance.connect(hall).connect(makeGain(audio, 0.4)).connect(out);
  const random = makeRandom(44);
  let nextBird = audio.currentTime + 2;
  const stopBirds = every(audio, 500, () => {
    if (audio.currentTime < nextBird) return;
    distantChirp(audio, distance, audio.currentTime + 0.05, random);
    nextBird = audio.currentTime + 6 + random() * 9;           // rare: a distant bird every 6–15 s
  });

  return keepGoing(audio, [leaves, gusts.oscillator, rustle, rustleWobble.oscillator], stopBirds);
}

function distantChirp(audio, out, when, random) {
  const side = audio.createStereoPanner ? audio.createStereoPanner() : makeGain(audio, 1);
  if (side.pan) side.pan.value = random() * 1.4 - 0.7;
  side.connect(out);
  const notes = 2 + Math.floor(random() * 3);
  const pitch = 2800 + random() * 2000;
  for (let i = 0; i < notes; i++) {
    const at = when + i * (0.09 + random() * 0.05);
    tone(audio, side, { when: at, pitch: pitch * (0.9 + random() * 0.1), duration: 0.12, volume: 0.012, slideTo: pitch * (1.02 + random() * 0.06), attack: 0.03 });
  }
}

// ---- The terminal ------------------------------------------------------------------------------

// The machine's electrical hum while the kernel panics.
export function panicHum(audio, out) {
  const buzz = audio.createOscillator();
  buzz.type = "sawtooth";
  buzz.frequency.value = 50;
  buzz.connect(makeFilter(audio, "lowpass", 180, 0.8)).connect(makeGain(audio, 0.45)).connect(out);
  const harmonic = audio.createOscillator();
  harmonic.frequency.value = 100;
  harmonic.connect(makeGain(audio, 0.15)).connect(out);
  const hiss = noiseSource(audio, 4, 61);
  hiss.loop = true;
  hiss.connect(makeFilter(audio, "highpass", 4000, 0.7)).connect(makeGain(audio, 0.03)).connect(out);
  return keepGoing(audio, [buzz, harmonic, hiss]);
}

// A glitch: each time one of four kinds, picked by a "looks random" pattern (the same on every visit):
//   static   a burst of hiss
//   stutter  digital chopping: the sound cut on and off very fast, like a broken signal
//   squeal   a radio squeal: a tone sweeping fast through static
//   data     a burst of tiny random-pitched blips, like data spilling out
// "duration" (seconds) comes from the page.
const glitchRandom = makeRandom(70);
const GLITCH_KINDS = ["static", "stutter", "squeal", "data"];
let glitchSeed = 70;
export function staticCrackle(audio, out, { when, duration = 0.25 }) {
  const kind = GLITCH_KINDS[Math.floor(glitchRandom() * GLITCH_KINDS.length)];
  const seed = (glitchSeed++ % 8) + 70;
  if (kind === "static") {
    noiseBurst(audio, out, { when, duration, volume: 0.12, type: "highpass", frequency: 2500, seed });
  } else if (kind === "stutter") {
    const chop = audio.createGain();
    chop.gain.value = 0;
    const lfo = audio.createOscillator();
    lfo.type = "square";
    lfo.frequency.value = 35 + glitchRandom() * 50;
    lfo.connect(chop.gain);
    chop.connect(out);
    noiseBurst(audio, chop, { when, duration, volume: 0.16, type: "bandpass", frequency: 1200 + glitchRandom() * 2500, q: 2, seed });
    tone(audio, chop, { when, pitch: 180 + glitchRandom() * 400, duration, volume: 0.05, wave: "square", attack: 0.002 });
    lfo.start(when);
    lfo.stop(when + duration + 0.05);
  } else if (kind === "squeal") {
    const from = 900 + glitchRandom() * 1500;
    tone(audio, out, { when, pitch: from, duration, volume: 0.035, slideTo: from * (glitchRandom() < 0.5 ? 0.4 : 2.2), attack: 0.005 });
    noiseBurst(audio, out, { when, duration, volume: 0.07, type: "highpass", frequency: 1800, seed });
  } else {
    const blips = Math.max(3, Math.round(duration / 0.025));
    for (let i = 0; i < blips; i++) {
      tone(audio, out, { when: when + i * (duration / blips), pitch: 600 + glitchRandom() * 3000, duration: 0.018, volume: 0.03, wave: "square", attack: 0.001 });
    }
  }
  return { length: duration };
}

// A keystroke: two kinds, mixed (a "looks random" pattern): a soft plastic tap, or a crisper mechanical
// click (a little thud under a sharp tick).
const keyRandom = makeRandom(80);
export function keystroke(audio, out, { when }) {
  if (keyRandom() < 0.6) {
    noiseBurst(audio, out, { when, duration: 0.02, volume: 0.04, type: "bandpass", frequency: 1800 + keyRandom() * 500, q: 2, seed: 81 });
  } else {
    noiseBurst(audio, out, { when, duration: 0.012, volume: 0.05, type: "highpass", frequency: 3500 + keyRandom() * 1500, seed: 82 });
    tone(audio, out, { when, pitch: 140 + keyRandom() * 60, duration: 0.03, volume: 0.04, wave: "triangle", attack: 0.002 });
  }
  return { length: 0.04 };
}

// The terminal's beep while its cursor waits: short, soft and square, like an old computer.
export function terminalBeep(audio, out, { when }) {
  const soft = makeFilter(audio, "lowpass", 2800, 0.7);
  soft.connect(out);
  tone(audio, soft, { when, pitch: 1320, duration: 0.07, volume: 0.05, wave: "square", attack: 0.004 });
  return { length: 0.1 };
}

// "Welcome Doctor": one soft, glassy chord that swells in and fades slowly.
export function welcomeChime(audio, out, { when }) {
  const hall = makeHall(audio, 3.5, 91);
  hall.connect(makeGain(audio, 0.7)).connect(out);
  for (const pitch of [659.26, 830.61, 987.77, 1318.5]) {
    for (const detune of [-4, 4]) {
      const voice = audio.createOscillator();
      voice.frequency.value = pitch;
      voice.detune.value = detune;
      const level = makeGain(audio, SILENT);
      level.gain.setValueAtTime(SILENT, when);
      level.gain.exponentialRampToValueAtTime(0.025, when + 0.4);           // swells in: no "ding"
      level.gain.exponentialRampToValueAtTime(SILENT, when + 3);
      voice.connect(level);
      level.connect(out);
      level.connect(hall);
      voice.start(when);
      voice.stop(when + 3.1);
    }
  }
  return { length: 4 };
}

// ---- The letter --------------------------------------------------------------------------------

// Angels singing: soft "aah" voices in a large, echoing space, slowly swelling and gliding between
// two chords. Each voice is two slightly out-of-tune tones shaped by the resonances of an "aah"
// vowel (the formants), with a gentle vibrato, like a choir.
const CHORDS = [
  [146.83, 220.0, 293.66, 369.99, 440.0],   // D major
  [196.0, 246.94, 293.66, 392.0, 493.88],   // G major
];
const AAH = [[800, 6, 1], [1150, 8, 0.5], [2900, 10, 0.25]];   // vowel resonances: [hertz, sharpness, strength]
const CHORD_EVERY = 9000;                                       // ms between chord changes

export function choirBed(audio, out) {
  const hall = makeHall(audio, 4.5, 101);
  hall.connect(makeGain(audio, 0.9)).connect(out);
  const choir = makeGain(audio, 0.5);
  const breathing = makeWobble(audio, 0.07, 0.15);              // the whole choir swells and eases
  breathing.amount.connect(choir.gain);
  choir.connect(out);
  choir.connect(hall);

  const sources = [breathing.oscillator];
  const random = makeRandom(102);
  const voices = CHORDS[0].map((pitch) => {
    const throat = makeGain(audio, 0.3);
    AAH.forEach(([frequency, q, strength]) => {
      const resonance = makeFilter(audio, "bandpass", frequency, q);
      throat.connect(resonance).connect(makeGain(audio, strength)).connect(choir);
    });
    const tones = [-7, 7].map((detune) => {
      const singer = audio.createOscillator();
      singer.type = "sawtooth";
      singer.frequency.value = pitch;
      singer.detune.value = detune;
      const vibrato = makeWobble(audio, 5 + random() * 0.8, 14);  // cents up and down
      vibrato.amount.connect(singer.detune);
      singer.connect(throat);
      sources.push(singer, vibrato.oscillator);
      return singer;
    });
    return tones;
  });

  let chord = 0;
  const stopChanging = every(audio, CHORD_EVERY, () => {
    chord = (chord + 1) % CHORDS.length;
    voices.forEach((tones, i) => tones.forEach((singer) => singer.frequency.setTargetAtTime(CHORDS[chord][i], audio.currentTime, 1.2)));
  });
  return keepGoing(audio, sources, stopChanging);
}

// The seal bursting: a warm, low bloom (a soft chord swelling up and fading in the room), no sparkles.
export function sealShimmer(audio, out, { when }) {
  const hall = makeHall(audio, 3, 111);
  hall.connect(makeGain(audio, 0.7)).connect(out);
  for (const pitch of [146.83, 220.0, 293.66, 369.99]) {          // D major, low and warm
    const voice = audio.createOscillator();
    voice.frequency.value = pitch;
    const level = makeGain(audio, SILENT);
    level.gain.setValueAtTime(SILENT, when);
    level.gain.exponentialRampToValueAtTime(0.06, when + 0.5);
    level.gain.exponentialRampToValueAtTime(SILENT, when + 2.6);
    voice.connect(level);
    level.connect(out);
    level.connect(hall);
    voice.start(when);
    voice.stop(when + 2.7);
  }
  return { length: 3 };
}
