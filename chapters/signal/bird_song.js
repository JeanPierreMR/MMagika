// THE BIRD'S SONG — the mockingjay's voice, made on the spot (no recording).
//
// What starts it:  signal.js, when the bird answers the call, and when it mirrors the visitor's notes.
// What it does:    whistles notes like a small bird: high up (folded into BIRD_LOWEST–BIRD_HIGHEST,
//                  keeping the tune's shape), each note starting with a quick upward slur (a "tweet"),
//                  a fast flutter in the pitch, a little tremble in the loudness and a breath of air;
//                  a tiny chirp before the first note, a trill on a long last note, and a short echo.
//                  It also feeds the sound to the drawing (the "listener"), so the drawing traces it.
// What it gives back: a promise that finishes when the song (and its echo) has faded.
// How loud:        "signal.bird" in shared/sound_orchestra/sound_book.js.

import { masterOutput, soundSystem } from "../shared/sound_orchestra/orchestra.js";
import { SOUND_BOOK } from "../shared/sound_orchestra/sound_book.js";
import { noiseSource } from "../shared/sound_orchestra/synth_recipes.js";

// The call: four notes, in hertz, and how long each lasts (seconds). (G, B-flat, A, D.)
// The recogniser (listen_for_the_call.js) compares what it hears with the SHAPE of this tune.
export const THE_CALL = [
  { pitch: 783.99, length: 0.42 },   // G
  { pitch: 932.33, length: 0.42 },   // B-flat
  { pitch: 880.0, length: 0.42 },    // A
  { pitch: 587.33, length: 0.95 },   // D, held
];

// The bird's voice. Change these to change how it sounds.
const BIRD_LOWEST = 1500;            // hertz: the bird always whistles between these two
const BIRD_HIGHEST = 4000;
const TWEET_TIME = 0.04;             // seconds of the quick upward slur at each note's start
const TWEET_FROM = 0.79;             // it starts this much lower (about a third below)
const FLUTTER_RATE = 22;             // a fast flutter in the pitch: times a second,
const FLUTTER = 25;                  //   and how far, in cents (100 cents = a semitone)
const TREMBLE_RATE = 14;             // a little tremble in the loudness: times a second,
const TREMBLE = 0.2;                 //   and how much
const BREATH = 0.15;                 // how much air is in the whistle
const TRILL_RATE = 17;               // a trill on a long last note: times a second,
const TRILL = 70;                    //   and how far, in cents
const BETWEEN_NOTES = 0.035;         // seconds of a slight dip between notes (each note is "spoken")
const ECHO_DELAY = 0.22;
const ECHO_STRENGTH = 0.25;
const SILENT = 0.0001;

// Moves the whole tune up or down by octaves so it sits in the bird's range (its shape stays the same).
function birdPitches(notes) {
  const middle = Math.exp(notes.reduce((sum, note) => sum + Math.log(note.pitch), 0) / notes.length);
  const target = Math.sqrt(BIRD_LOWEST * BIRD_HIGHEST);
  const octaves = Math.round(Math.log2(target / middle));
  return notes.map((note) => note.pitch * 2 ** octaves);
}

// How long singing these notes takes, echo included (seconds).
export function songLength(notes) {
  return 0.15 + notes.reduce((sum, note) => sum + note.length, 0) + 1.0;
}

// The visitor's notes (from the recogniser) turned into notes the bird can sing back: same tune and
// rhythm, a little quicker, as a bird would.
export function notesFromVoice(heard) {
  return heard.map((note, i) => ({
    pitch: 440 * 2 ** (note.semitone / 12),
    length: Math.min(i === heard.length - 1 ? 0.8 : 0.55, Math.max(0.14, (note.end - note.start) * 0.85)),
  }));
}

// Sing any notes. "listener" is an optional AnalyserNode (the drawing) that hears the song too.
export function singNotes(notes, listener = null, { volume = SOUND_BOOK["signal.bird"].volume } = {}) {
  const audio = soundSystem();
  const out = masterOutput();
  const pitches = birdPitches(notes);
  const start = audio.currentTime + 0.08;
  const firstNote = start + 0.09;                      // after the little chirp

  const whistle = audio.createOscillator();
  const flutter = wobble(audio, FLUTTER_RATE, FLUTTER, whistle.detune);
  const trill = wobble(audio, TRILL_RATE, 0, whistle.detune, "square");
  const tremble = audio.createGain();
  tremble.gain.value = 1 - TREMBLE;
  const trembling = wobble(audio, TREMBLE_RATE, TREMBLE, tremble.gain);
  const loudness = audio.createGain();
  loudness.gain.setValueAtTime(SILENT, start);

  // A breath of air, following the whistle's pitch.
  const air = noiseSource(audio, 3, 121);
  const airShape = audio.createBiquadFilter();
  airShape.type = "bandpass";
  airShape.Q.value = 6;
  const airLevel = audio.createGain();
  airLevel.gain.value = BREATH;
  air.connect(airShape).connect(airLevel).connect(loudness);

  let time = firstNote;
  notes.forEach((note, i) => {
    const pitch = pitches[i];
    whistle.frequency.setValueAtTime(pitch * TWEET_FROM, time);
    whistle.frequency.exponentialRampToValueAtTime(pitch, time + TWEET_TIME);
    airShape.frequency.setValueAtTime(pitch, time);
    loudness.gain.exponentialRampToValueAtTime(volume, time + 0.025);
    loudness.gain.exponentialRampToValueAtTime(volume * 0.7, time + note.length - BETWEEN_NOTES);
    loudness.gain.exponentialRampToValueAtTime(volume * 0.25, time + note.length);
    const isLast = i === notes.length - 1;
    if (isLast && note.length >= 0.5) {                  // a trill on a long last note
      trill.amount.gain.setValueAtTime(0, time + 0.12);
      trill.amount.gain.linearRampToValueAtTime(TRILL, time + 0.22);
      trill.amount.gain.linearRampToValueAtTime(0, time + note.length);
    }
    time += note.length;
  });
  loudness.gain.exponentialRampToValueAtTime(SILENT, time + 0.12);

  whistle.connect(tremble).connect(loudness);
  chirp(audio, out, start, pitches[0], volume);          // straight out: the whistle is still silent then

  // The echo: a delayed, softer, slightly muffled copy that repeats a couple of times.
  const echo = audio.createDelay(1);
  echo.delayTime.value = ECHO_DELAY;
  const echoFade = audio.createGain();
  echoFade.gain.value = ECHO_STRENGTH;
  const muffle = audio.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = 2800;
  echo.connect(muffle).connect(echoFade).connect(echo);

  loudness.connect(out);
  loudness.connect(echo);
  echoFade.connect(out);
  if (listener) {
    loudness.connect(listener);
    echoFade.connect(listener);
  }

  const end = time + 0.3;
  for (const source of [whistle, flutter.oscillator, trill.oscillator, trembling.oscillator, air]) {
    source.start(start);
    source.stop(end);
  }
  const total = time - audio.currentTime + 1.0;          // including the echo dying away
  return new Promise((resolve) => setTimeout(resolve, total * 1000));
}

// Sing the call (the bird's answer).
export function singTheCall(listener = null, options = {}) {
  return singNotes(THE_CALL, listener, options);
}

// An oscillator wobbling a setting (pitch in cents, or loudness).
function wobble(audio, rate, depth, setting, type = "sine") {
  const oscillator = audio.createOscillator();
  oscillator.type = type;
  oscillator.frequency.value = rate;
  const amount = audio.createGain();
  amount.gain.value = depth;
  oscillator.connect(amount).connect(setting);
  return { oscillator, amount };
}

// A tiny chirp just before the first note: a quick sweep down from above it.
function chirp(audio, out, when, pitch, volume) {
  const peep = audio.createOscillator();
  peep.frequency.setValueAtTime(pitch * 1.5, when);
  peep.frequency.exponentialRampToValueAtTime(pitch * 1.12, when + 0.05);
  const level = audio.createGain();
  level.gain.setValueAtTime(SILENT, when);
  level.gain.exponentialRampToValueAtTime(volume * 0.6, when + 0.01);
  level.gain.exponentialRampToValueAtTime(SILENT, when + 0.06);
  peep.connect(level).connect(out);
  peep.start(when);
  peep.stop(when + 0.08);
}
