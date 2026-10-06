// THE BIRD'S SONG — the mockingjay's voice, made on the spot (no recording).
//
// What starts it:  signal.js: when the visitor sings the call (a choir of birds answers), and when they
//                  sing four other notes (one bird mirrors them, its last note sinking into the dark).
// What it does:    whistles notes like a small bird, slowly and softly: high up (moved into
//                  BIRD_LOWEST–BIRD_HIGHEST by whole octaves, so the tune keeps its shape), each note
//                  opening with a gentle upward glide, a light flutter in the pitch, a little tremble in
//                  the loudness and a breath of air, a soft trill on a long last note, and an echo.
//                  It also feeds the sound to the drawing (the "listener"), so the drawing traces it.
//                  For the right call, several birds sing ONE call together (singTheChoir).
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

// The choir that answers the right call: ONE call, sung together, in time. The lead bird starts alone;
// each other bird joins at a later note of the same call ("joinsAt": 0 = the first note), singing its
// own harmony line, and on the held last note the lines glide together into the lead's note
// ("merges"), so the call ends as a single voice. Like lines on a graph joining into one.
// Pitches are for the call in G minor; they're moved to the key the visitor sang in.
const CHOIR = [
  { line: [783.99, 932.33, 880.0, 587.33], joinsAt: 0, merges: false, detune: 0, pan: 0 },     // the lead: the call
  { line: [932.33, 1174.66, 1046.5, 698.46], joinsAt: 1, merges: true, detune: 5, pan: -0.45 },  // a third above
  { line: [523.25, 622.25, 698.46, 466.16], joinsAt: 2, merges: true, detune: -6, pan: 0.45 },  // below, rising to meet
  { line: [391.99, 466.16, 440.0, 293.66], joinsAt: 3, merges: false, detune: 3, pan: -0.15 },  // an octave below: the same line, deeper
];
const JOIN_FADE = 0.3;               // seconds a joining bird takes to fade in
const MERGE_BY = 0.55;               // the lines have met by this share of the last note

// The bird's voice. Change these to change how it sounds.
const SLOWER = 1.45;                 // how much slower than written the bird sings (1 = as written)
const BIRD_LOWEST = 1500;            // hertz: the bird whistles between these two
const BIRD_HIGHEST = 4000;
const GLIDE_TIME = 0.08;             // seconds of the gentle upward glide at each note's start
const GLIDE_FROM = 0.92;             // it starts this much lower (about a semitone and a half)
const FLUTTER_RATE = 16;             // a light flutter in the pitch: times a second,
const FLUTTER = 12;                  //   and how far, in cents (100 cents = a semitone)
const TREMBLE_RATE = 9;              // a little tremble in the loudness: times a second,
const TREMBLE = 0.1;                 //   and how much
const BREATH = 0.12;                 // how much air is in the whistle
const TRILL_RATE = 12;               // a soft trill on a long last note: times a second,
const TRILL = 35;                    //   and how far, in cents
const BETWEEN_NOTES = 0.05;          // seconds of a slight dip between notes (each note is "spoken")
const FALL_TO = 0.5;                 // a mirrored wrong tune: the last note sinks to this (0.5 = an octave down)
const ECHO_DELAY = 0.26;
const ECHO_STRENGTH = 0.28;
const SILENT = 0.0001;

// How many octaves to move a tune so it sits in the bird's range (its shape stays the same).
function octavesIntoRange(pitches) {
  const middle = Math.exp(pitches.reduce((sum, pitch) => sum + Math.log(pitch), 0) / pitches.length);
  return Math.round(Math.log2(Math.sqrt(BIRD_LOWEST * BIRD_HIGHEST) / middle));
}

// How long singing these notes takes, echo included (seconds).
export function songLength(notes) {
  return 0.15 + notes.reduce((sum, note) => sum + note.length, 0) * SLOWER + 1.3;
}

// The visitor's notes (from the recogniser) turned into notes the bird can sing back: same tune and rhythm.
export function notesFromVoice(heard) {
  return heard.map((note, i) => ({
    pitch: 440 * 2 ** (note.semitone / 12),
    length: Math.min(i === heard.length - 1 ? 0.9 : 0.6, Math.max(0.2, note.end - note.start)),
  }));
}

// Sing any notes. Options:
//   listener   an AnalyserNode (the drawing) that hears the song too
//   volume     how loud (default: "signal.bird" in the sound book)
//   delay      seconds before starting
//   octaves    move the notes by this many octaves (default: whatever fits the bird's range)
//   pan        -1 (left) to 1 (right)
//   flutterRate  this bird's own flutter (so several birds don't sound identical)
//   fallAtEnd  the last note sinks down (a mirrored wrong tune, turning dark)
//   joinsAt    stay silent until this note, then fade in (a bird joining the choir)
//   mergeTo    a pitch the last note glides into (the choir's lines joining into one)
//   detune     cents, so voices in a choir aren't perfectly identical
export function singNotes(notes, { listener = null, volume = SOUND_BOOK["signal.bird"].volume, delay = 0,
  octaves = null, pan = 0, flutterRate = FLUTTER_RATE, fallAtEnd = false, joinsAt = 0, mergeTo = null,
  detune = 0 } = {}) {
  const audio = soundSystem();
  const shift = 2 ** (octaves ?? octavesIntoRange(notes.map((n) => n.pitch)));
  const pitches = notes.map((note) => note.pitch * shift);
  const start = audio.currentTime + 0.08 + delay;

  const out = audio.createStereoPanner ? audio.createStereoPanner() : audio.createGain();
  if (out.pan) out.pan.value = pan;
  out.connect(masterOutput());

  const whistle = audio.createOscillator();
  whistle.detune.value = detune;
  const flutter = wobble(audio, flutterRate, FLUTTER, whistle.detune);
  const trill = wobble(audio, TRILL_RATE, 0, whistle.detune);
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

  let time = start;
  notes.forEach((note, i) => {
    const pitch = pitches[i];
    const isLast = i === notes.length - 1;
    const length = note.length * SLOWER * (isLast && fallAtEnd ? 1.8 : 1);
    whistle.frequency.setValueAtTime(pitch * GLIDE_FROM, time);
    whistle.frequency.exponentialRampToValueAtTime(pitch, time + GLIDE_TIME);
    airShape.frequency.setValueAtTime(pitch, time);
    if (i < joinsAt) { time += length; return; }         // not joined yet: silent
    if (i === joinsAt && i > 0) {                        // joining: fade in gently
      loudness.gain.setValueAtTime(SILENT, time);
      loudness.gain.exponentialRampToValueAtTime(volume, time + JOIN_FADE);
    } else {
      loudness.gain.exponentialRampToValueAtTime(volume, time + 0.05);
    }
    if (isLast && mergeTo) {                             // glide into the one shared note
      whistle.frequency.setValueAtTime(pitch, time + GLIDE_TIME + 0.05);
      whistle.frequency.exponentialRampToValueAtTime(mergeTo * shift, time + length * MERGE_BY);
      airShape.frequency.exponentialRampToValueAtTime(mergeTo * shift, time + length * MERGE_BY);
    }
    if (isLast && fallAtEnd) {                           // sinks into a deeper note, fading
      whistle.frequency.setValueAtTime(pitch, time + length * 0.3);
      whistle.frequency.exponentialRampToValueAtTime(pitch * FALL_TO, time + length);
      airShape.frequency.exponentialRampToValueAtTime(pitch * FALL_TO, time + length);
      loudness.gain.exponentialRampToValueAtTime(volume * 0.15, time + length);
    } else {
      loudness.gain.exponentialRampToValueAtTime(volume * 0.75, time + length - BETWEEN_NOTES);
      loudness.gain.exponentialRampToValueAtTime(volume * 0.3, time + length);
    }
    if (isLast && !fallAtEnd && !mergeTo && length >= 0.7) {         // a soft trill on a long last note
      trill.amount.gain.setValueAtTime(0, time + 0.2);
      trill.amount.gain.linearRampToValueAtTime(TRILL, time + 0.4);
      trill.amount.gain.linearRampToValueAtTime(0, time + length);
    }
    time += length;
  });
  loudness.gain.exponentialRampToValueAtTime(SILENT, time + 0.2);
  whistle.connect(tremble).connect(loudness);

  // The echo: a delayed, softer, slightly muffled copy that repeats a couple of times.
  const echo = audio.createDelay(1);
  echo.delayTime.value = ECHO_DELAY;
  const echoFade = audio.createGain();
  echoFade.gain.value = ECHO_STRENGTH;
  const muffle = audio.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = 2600;
  echo.connect(muffle).connect(echoFade).connect(echo);

  loudness.connect(out);
  loudness.connect(echo);
  echoFade.connect(out);
  if (listener) {
    loudness.connect(listener);
    echoFade.connect(listener);
  }

  const end = time + 0.4;
  for (const source of [whistle, flutter.oscillator, trill.oscillator, trembling.oscillator, air]) {
    source.start(start);
    source.stop(end);
  }
  const total = time - audio.currentTime + 1.3;          // including the echo dying away
  return new Promise((resolve) => setTimeout(resolve, total * 1000));
}

// One bird sings the call (in the original key).
export function singTheCall(listener = null) {
  return singNotes(THE_CALL, { listener });
}

// The answer to the right call: a choir of birds singing ONE call together, in the key the visitor
// sang it ("heard": the recogniser's four notes; without it, the original key). See CHOIR above.
export function singTheChoir(heard = null, listener = null) {
  const lead = CHOIR[0].line;
  const moveBy = heard ? 2 ** ((heard[0].semitone - 12 * Math.log2(lead[0] / 440)) / 12) : 1;
  const octaves = octavesIntoRange(lead.map((pitch) => pitch * moveBy));   // the same for every bird
  const volume = SOUND_BOOK["signal.bird"].volume;
  const leadLast = lead[lead.length - 1] * moveBy;
  return Promise.all(CHOIR.map((bird, number) => singNotes(
    bird.line.map((pitch, i) => ({ pitch: pitch * moveBy, length: THE_CALL[i].length })),
    {
      listener,
      octaves,
      joinsAt: bird.joinsAt,
      mergeTo: bird.merges ? leadLast : null,
      detune: bird.detune,
      pan: bird.pan,
      volume: volume * (number === 0 ? 1 : 0.6),          // the lead stays in front
      flutterRate: FLUTTER_RATE + number * 1.3,
    },
  )));
}

// An oscillator wobbling a setting (pitch in cents, or loudness).
function wobble(audio, rate, depth, setting) {
  const oscillator = audio.createOscillator();
  oscillator.frequency.value = rate;
  const amount = audio.createGain();
  amount.gain.value = depth;
  oscillator.connect(amount).connect(setting);
  return { oscillator, amount };
}
