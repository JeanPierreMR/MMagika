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

// The vault opens: heavy bolts slide back, a deep swell rises, then a bright airy shimmer as the light
// from inside blinds the view, and everything fades out into the white (matches vault.css "Opening").
export function vaultOpen(audio, out, { when }) {
  for (let i = 0; i < 4; i++) {                                     // the bolts
    tone(audio, out, { when: when + i * 0.22, pitch: 90, duration: 0.3, volume: 0.3, wave: "triangle", slideTo: 55 });
    noiseBurst(audio, out, { when: when + i * 0.22, duration: 0.18, volume: 0.25, type: "bandpass", frequency: 600, q: 2, seed: 20 + i });
  }
  noiseBurst(audio, out, { when: when + 1.1, duration: 2.2, volume: 0.1, type: "bandpass", frequency: 380, q: 9, seed: 25 });   // the creak

  const hall = makeHall(audio, 3.5, 21);
  const wet = makeGain(audio, 0.6);
  hall.connect(wet).connect(out);

  // The deep swell: rises from the weight of the door into the light.
  const swell = audio.createOscillator();
  swell.frequency.setValueAtTime(48, when + 1.0);
  swell.frequency.exponentialRampToValueAtTime(110, when + 3.4);
  const swellLevel = makeGain(audio, SILENT);
  swellLevel.gain.setValueAtTime(SILENT, when + 1.0);
  swellLevel.gain.exponentialRampToValueAtTime(0.28, when + 2.6);
  swellLevel.gain.exponentialRampToValueAtTime(SILENT, when + 4.4);
  swell.connect(swellLevel).connect(out);
  swellLevel.connect(hall);
  swell.start(when + 1.0);
  swell.stop(when + 4.5);

  // The shimmer: a bright, quivering chord, fading in as the light floods out.
  for (const [i, pitch] of [1760, 2217.5, 2637, 3520, 4434.9].entries()) {
    const voice = audio.createOscillator();
    voice.frequency.value = pitch;
    const quiver = makeWobble(audio, 5 + i * 0.7, 0.4);
    const level = makeGain(audio, SILENT);
    quiver.amount.connect(level.gain);
    level.gain.setValueAtTime(SILENT, when + 1.8);
    level.gain.exponentialRampToValueAtTime(0.03, when + 3.0);
    level.gain.exponentialRampToValueAtTime(SILENT, when + 4.4);
    voice.connect(level).connect(hall);
    voice.start(when + 1.8);
    quiver.oscillator.start(when + 1.8);
    voice.stop(when + 4.5);
    quiver.oscillator.stop(when + 4.5);
  }
  // Air rushing out with the light.
  noiseBurst(audio, hall, { when: when + 2.2, duration: 2.0, volume: 0.05, type: "highpass", frequency: 5000, seed: 26 });
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

// A wrong tune turns dark: as the bird's last note sinks, low voices join one by one underneath (like a
// low choir singing "ooh"), building a dark chord, then their lines glide together into one low note,
// which fades in a large dark space. Change the voices in LOW_CHOIR.
//   from: the note a voice joins on (hertz), joins: seconds after the start it fades in.
//   All of them meet on MEET_ON at MEET_AT seconds, hold, and fade by FADE_BY.
const LOW_CHOIR = [
  { from: 73.42, joins: 0.0 },    // D2, the ground
  { from: 110.0, joins: 0.6 },    // A2, above
  { from: 87.31, joins: 1.2 },    // F2, the minor third: dark
  { from: 58.27, joins: 1.8 },    // B♭1, below: darker still
];
const MEET_ON = 73.42;            // D2: where every voice ends up
const MEET_AT = [2.8, 3.8];       // seconds: the lines start gliding together, and have met
const FADE_BY = 5.2;
const OOH = [[320, 5, 1], [780, 6, 0.35]];   // the "ooh" vowel's resonances: [hertz, sharpness, strength]

export function darkTurn(audio, out, { when }) {
  const hall = makeHall(audio, 4, 51);
  hall.connect(makeGain(audio, 0.7)).connect(out);
  const voices = makeGain(audio, 1);
  OOH.forEach(([frequency, q, strength]) => {
    voices.connect(makeFilter(audio, "bandpass", frequency, q)).connect(makeGain(audio, strength * 3)).connect(out);
  });
  voices.connect(makeFilter(audio, "lowpass", 260, 0.7)).connect(makeGain(audio, 0.6)).connect(out);   // the body
  voices.connect(hall);

  LOW_CHOIR.forEach(({ from, joins }, number) => {
    for (const detune of [-6, 6]) {                       // each voice: two slightly different singers
      const singer = audio.createOscillator();
      singer.type = "sawtooth";
      singer.detune.value = detune + number * 2;
      singer.frequency.setValueAtTime(from, when);
      singer.frequency.setValueAtTime(from, when + MEET_AT[0]);
      singer.frequency.exponentialRampToValueAtTime(MEET_ON, when + MEET_AT[1]);   // the lines join into one
      const level = makeGain(audio, SILENT);
      level.gain.setValueAtTime(SILENT, when + joins);
      level.gain.exponentialRampToValueAtTime(0.05, when + joins + 0.5);
      level.gain.setValueAtTime(0.05, when + MEET_AT[1]);
      level.gain.exponentialRampToValueAtTime(SILENT, when + FADE_BY);
      singer.connect(level).connect(voices);
      singer.start(when + joins);
      singer.stop(when + FADE_BY + 0.1);
    }
  });
  return { length: FADE_BY + 0.5 };
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

// A crackle of static (glitches).
let staticSeed = 70;
export function staticCrackle(audio, out, { when, duration = 0.25 }) {
  noiseBurst(audio, out, { when, duration, volume: 0.12, type: "highpass", frequency: 2500, seed: staticSeed++ % 8 + 70 });
  return { length: duration };
}

// A soft keystroke (the terminal typing).
const keyRandom = makeRandom(80);
export function keystroke(audio, out, { when }) {
  noiseBurst(audio, out, { when, duration: 0.02, volume: 0.04, type: "bandpass", frequency: 1800 + keyRandom() * 500, q: 2, seed: 81 });
  return { length: 0.03 };
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
