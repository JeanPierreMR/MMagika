// THE BIRD'S SONG — the mockingjay and the other birds, made on the spot (no recording).
//
// What starts it:  signal.js: when the visitor sings the call (a choir answers with the call), and when they
//                  sing four other notes (a few birds mirror them, a little off: out of tune, out of time).
// What it does:    sings notes slowly and softly. Each singer is a VOICE (voices.js): normally a bird, but the
//                  choir can be sung by a flute, violin, cello or choir "aah" instead (CHOIR_VOICE, or the
//                  sound lab's dropdown). A bird whistles high up (moved by whole octaves into its range, so the
//                  tune keeps its shape), opens each note with a gentle glide, drifts in pitch, breathes, and
//                  sometimes trills; other voices sing with their own range, attack and vibrato (VOICE_STYLES).
//                  It also feeds the sound to the drawing (the "listener"), so the drawing traces it.
// What it gives back: a promise that finishes when the song (and its echo) has faded.
// How loud:        "signal.bird" in sound_book.js.
// ALL ITS SETTINGS ARE IN ONE PLACE, JUST BELOW: the choir, the wrong tune, the voices, fades, timings.

import { masterOutput, soundSystem } from "../shared/sound_orchestra/orchestra.js";
import { SOUND_BOOK } from "../shared/sound_orchestra/sound_book.js";
import { MINOR, harmonize } from "../shared/sound_orchestra/harmony.js";
import { VOICES, makeVoice } from "../shared/sound_orchestra/voices.js";
import { makeRandom } from "../shared/looks_random.js";

export { VOICES };

// =====================================================================================================
// SETTINGS — everything about the signal's music, in one place. Change the numbers here.
// =====================================================================================================

// ---- The call -----------------------------------------------------------------------------------
// Four notes, in hertz, and how long each lasts (seconds). (G, B-flat, A, D: G minor.)
// The recogniser (listen_for_the_call.js) compares what it hears with the SHAPE of this tune.
export const THE_CALL = [
  { pitch: 783.99, length: 0.42 },   // G
  { pitch: 932.33, length: 0.42 },   // B-flat
  { pitch: 880.0, length: 0.42 },    // A
  { pitch: 587.33, length: 0.95 },   // D, held
];
const CALL_KEY = { tonic: 391.995, scale: MINOR };   // its key: G minor (used to work out harmonies)

// ---- The right call: a choir of birds singing ONE call together -----------------------------------
// The lead sings the call; the other PARTS join and sing it in harmony, like a choir: each part sings the
// lead's melody a number of SCALE STEPS away, worked out in the key the visitor sang (harmony.js). Like a
// choir's sections, each part is sung by several birds at once ("birds"), each a little different
// (CHOIR_SPREAD), so every line sounds full rather than like one whistle.
//
//   steps    the harmony: 0 the call, +2 a third above, +4 a fifth above, -2 a third below,
//            -5 a sixth below, -7 an octave below
//   birds    how many birds sing this part
//   joinsAt  WHEN the part starts, counted in notes of the call (4 notes): 0 = with the first note,
//            0.5 = halfway through the first, 1 = on the second, 2.5 = halfway through the third.
//            Smaller = sooner, bigger = later.
//   merges   true: on the last note its line glides into the lead's note; false: it stays apart
//   pan      where the part sits: -1 left … 0 middle … 1 right (its birds spread around that)
const CHOIR = [
  { steps: 0, birds: 1, joinsAt: 0, merges: false, pan: 0 },        // the lead: the call itself
  { steps: 2, birds: 1, joinsAt: 0.3, merges: false, pan: -0.45 },  // a third above
  { steps: 4, birds: 2, joinsAt: 1.2, merges: false, pan: 0.2 },    // a fifth above
  { steps: -5, birds: 3, joinsAt: 0.8, merges: false, pan: 0.45 },  // a sixth below
  { steps: -7, birds: 3, joinsAt: 1.7, merges: false, pan: -0.15 }, // an octave below: the same line, deeper
];
const CHOIR_FADE_IN = 1.0;           // FADE-IN: seconds each joining bird takes to swell in
const CHOIR_MERGE_BY = 0.55;         // where lines merge, they have met by this share of the last note
const CHOIR_OTHERS_VOLUME = 0.35;    // the other parts, compared with the lead (1 = as loud)
export const CHOIR_VOICE = "bird+flute";   // WHO sings the choir: "bird", "flute", "violin", "cello", "aah" (voices.js),
                                     //   or "bird+flute": the lead is a bird, every other part a flute
export const MIXED_VOICES = { "bird+flute": { lead: "bird", others: "flute", label: "bird lead + flutes" } };
const CHOIR_VOLUME = 0.75;           // the whole choir, compared with one bird alone
const CHOIR_SPREAD = {               // how the birds of one part differ from each other:
  cents: 14,                         //   up to this much out of tune (makes the line full and alive)
  pan: 0.25,                         //   spread this far left/right around the part's place
  joinsLater: 0.12,                  //   each next bird of a part joins this many notes after the one before
  looseTiming: 0.045,                //   seconds each bird may be early or late on each note (real birds are)
};

// ---- A wrong tune: a few birds mirror it, a little off ---------------------------------------------
// The visitor's four notes come back from a few birds that don't quite get them right: each a little out of
// tune and out of time, the last note bending flat. Short, so the page can listen again soon.
//   birds        how many birds mirror it
//   outOfTune    cents each bird is off (each a different amount, some sharp, some flat; 100 = a semitone)
//   looseTiming  seconds each bird may be early or late on each note
//   bendAtEnd    cents the last note bends as it ends (negative = flat, going "off")
//   offFromMiddle cents each bird drifts further away, from the middle of the tune to its end (goes "off road")
//   upsideDown   true: the birds sing the tune turned over — down where the visitor went up, up where they went down
//   volume       compared with one bird alone
//   voice        who sings it: "bird" (or any voice in voices.js)
export const WRONG_TUNE = {
  birds: 3,
  outOfTune: 35,
  looseTiming: 0.08,
  bendAtEnd: -70,
  offFromMiddle: 220,
  upsideDown: true,
  volume: 0.8,
  voice: "bird",
};

// ---- How each voice is sung --------------------------------------------------------------------------
// The sound of each voice is made in voices.js; HOW it's sung is set here:
//   range     hertz: the tune is moved by whole octaves to sit between these two
//   glide     how it starts each note: from this much lower (0.92 = about a semitone and a half), taking
//             glideTime seconds (a bird's little upward slide; a violin barely slides)
//   attack    seconds to reach full loudness at the start of a phrase
//   vibrato   [times a second, cents, seconds before it starts]  (0 cents = none)
//   wander    cents of uneven pitch drift (alive) — the birds' main secret
//   trills    true: a choir bird may break its long last note into quick pips (birds only)
const VOICE_STYLES = {
  bird: { range: [1000, 4000], glide: 0.92, glideTime: 0.08, attack: 0.05, vibrato: [16, 6, 0], wander: 50, trills: true },
  flute: { range: [262, 2100], glide: 0.98, glideTime: 0.05, attack: 0.08, vibrato: [5, 12, 0.25], wander: 8, trills: false },
  violin: { range: [196, 1600], glide: 0.99, glideTime: 0.06, attack: 0.15, vibrato: [5.5, 20, 0.2], wander: 6, trills: false },
  cello: { range: [65, 520], glide: 0.99, glideTime: 0.07, attack: 0.2, vibrato: [5, 18, 0.25], wander: 6, trills: false },
  aah: { range: [130, 700], glide: 0.97, glideTime: 0.1, attack: 0.25, vibrato: [5.2, 15, 0.3], wander: 10, trills: false },
};

// ---- The bird's voice (and every voice's) ------------------------------------------------------------
const SLOWER = 1.70;                 // how much slower than written the bird sings (1 = as written)
const FLUTTER_RATE = 16;             // a light, regular flutter in the pitch: times a second,
const FLUTTER = 6;                   //   and how far, in cents
const TREMBLE_RATE = 9;              // a little tremble in the loudness: times a second,
const TREMBLE = 0.1;                 //   and how much
const TRILL_RATE = 12;               // a soft trill on a long last note: times a second,
const TRILL = 35;                    //   and how far, in cents
const BETWEEN_NOTES = 0.05;          // seconds of a slight dip between notes (each note is "spoken")
const ECHO_DELAY = 0.26;
const ECHO_STRENGTH = 0.28;
// What makes it sound like a living bird rather than a synthesizer:
const WANDER_SPEEDS = [2.3, 4.7, 8.9];   // the pitch drift ("wander" above) is three slow wobbles that never line up
const PIPS_RATE = 22;                // a bird's trill: a long note broken into quick pips, this many a second,
const PIPS = 0.75;                   //   how deep the breaks are (0 none … 1 full silence between pips),
const PIPS_CHANCE = 0.5;             //   and the share of choir birds that trill their long last note

// =====================================================================================================

const SILENT = 0.0001;
const START_GAP = 0.08;              // seconds between asking a bird to sing and its first note

// How many octaves to move a tune so it sits in a voice's range (its shape stays the same).
function octavesIntoRange(pitches, voice = "bird") {
  const [low, high] = (VOICE_STYLES[voice] ?? VOICE_STYLES.bird).range;
  const middle = Math.exp(pitches.reduce((sum, pitch) => sum + Math.log(pitch), 0) / pitches.length);
  return Math.round(Math.log2(Math.sqrt(low * high) / middle));
}

// How long each note lasts when sung (seconds).
function noteLengths(notes) {
  return notes.map((note) => note.length * SLOWER);
}

// How long a mirrored wrong tune lasts, echo included (seconds): the page listens again after this.
export function wrongTuneLength(notes) {
  return START_GAP + noteLengths(notes).reduce((sum, length) => sum + length, 0) + WRONG_TUNE.looseTiming + 1.3;
}

// A wrong tune: a few birds mirror it, each a little out of tune and out of time, the last note bending.
export function mirrorTheWrongTune(heardNotes, listener = null, voice = WRONG_TUNE.voice) {
  // Upside down: every jump between notes goes the opposite way (the first note stays where it was).
  const notes = WRONG_TUNE.upsideDown
    ? heardNotes.map((note) => ({ ...note, pitch: (heardNotes[0].pitch ** 2) / note.pitch }))
    : heardNotes;
  const octaves = octavesIntoRange(notes.map((note) => note.pitch), voice);   // the same for every bird
  const random = makeRandom(777);
  const volume = (SOUND_BOOK["signal.bird"].volume * WRONG_TUNE.volume) / Math.sqrt(WRONG_TUNE.birds);
  return Promise.all(Array.from({ length: WRONG_TUNE.birds }, (_, bird) => singNotes(notes, {
    listener,
    octaves,
    voice,
    volume,
    seed: 2000 + bird,
    detune: (random() < 0.5 ? -1 : 1) * WRONG_TUNE.outOfTune * (0.5 + random() * 0.5),
    loose: WRONG_TUNE.looseTiming,
    bendAtEnd: WRONG_TUNE.bendAtEnd * (0.6 + random() * 0.8),
    drift: (random() < 0.5 ? -1 : 1) * WRONG_TUNE.offFromMiddle * (0.6 + random() * 0.6),
    pan: (bird / Math.max(1, WRONG_TUNE.birds - 1)) * 0.8 - 0.4,
  })));
}

// One part of a choir: several singers on the same line, each a little different (CHOIR_SPREAD).
// "number" makes each part's spread different, and the same on every visit.
function singPart(line, part, number, { listener, octaves, volume, fadeIn, voice, mergeTo = null }) {
  const random = makeRandom(500 + number);
  return Array.from({ length: part.birds ?? 1 }, (_, bird) => singNotes(line, {
    listener,
    octaves,
    voice,
    mergeTo,
    fadeIn,
    joinsAt: (part.joinsAt ?? 0) + bird * CHOIR_SPREAD.joinsLater,
    detune: (random() * 2 - 1) * CHOIR_SPREAD.cents,
    pan: Math.max(-1, Math.min(1, (part.pan ?? 0) + (random() * 2 - 1) * CHOIR_SPREAD.pan)),
    volume: volume / Math.sqrt(part.birds ?? 1),          // a fuller part, not a louder one
    flutterRate: FLUTTER_RATE * (0.85 + random() * 0.3),
    seed: 1000 + number * 37 + bird,
    loose: CHOIR_SPREAD.looseTiming,
    pips: random() < PIPS_CHANCE,
  }));
}

// The visitor's notes (from the recogniser) turned into notes the bird can sing back: same tune and rhythm.
export function notesFromVoice(heard) {
  return heard.map((note, i) => ({
    pitch: 440 * 2 ** (note.semitone / 12),
    length: Math.min(i === heard.length - 1 ? 0.9 : 0.6, Math.max(0.2, note.end - note.start)),
  }));
}

// Sing any notes. Options:
//   voice      who sings: "bird" (default), "flute", "violin", "cello", "aah" (voices.js)
//   listener   an AnalyserNode (the drawing) that hears the song too
//   volume     how loud (default: "signal.bird" in the sound book)
//   delay      seconds before starting
//   octaves    move the notes by this many octaves (default: whatever fits the voice's range)
//   pan        -1 (left) to 1 (right)
//   flutterRate  this singer's own flutter (so several don't sound identical)
//   joinsAt    stay silent until this point (in notes: 1.5 = halfway through the second), then fade in
//   mergeTo    a pitch the last note glides into (the choir's lines joining into one)
//   bendAtEnd  cents the last note bends as it ends (a mirrored wrong tune going "off")
//   drift      cents the singer slides further off, from the middle of the tune to its end
//   detune     cents, so singers in a choir aren't perfectly identical (or a wrong tune is out of tune)
//   fadeIn     seconds a joining singer takes to swell in
//   seed       makes this singer's little irregularities its own (and the same on every visit)
//   loose      seconds this singer may be early or late on each note
//   pips       a bird may trill its long last note in quick pips
export function singNotes(notes, { voice = "bird", listener = null, volume = SOUND_BOOK["signal.bird"].volume,
  delay = 0, octaves = null, pan = 0, flutterRate = FLUTTER_RATE, joinsAt = 0, mergeTo = null, bendAtEnd = 0, drift = 0,
  detune = 0, fadeIn = CHOIR_FADE_IN, seed = 1, loose = 0, pips = false } = {}) {
  const audio = soundSystem();
  const style = VOICE_STYLES[voice] ?? VOICE_STYLES.bird;
  const random = makeRandom(seed);
  const shift = 2 ** (octaves ?? octavesIntoRange(notes.map((n) => n.pitch), voice));
  const pitches = notes.map((note) => note.pitch * shift);
  const start = audio.currentTime + START_GAP + delay;
  // When each note starts: as written, each nudged a little early or late (loose), never out of order.
  const written = noteLengths(notes);
  const starts = written.map((_, i) => start + written.slice(0, i).reduce((sum, length) => sum + length, 0)
    + (i > 0 ? (random() * 2 - 1) * loose : 0));
  const lengths = starts.map((at, i) => (i < starts.length - 1 ? starts[i + 1] - at : written[i]));

  const out = audio.createStereoPanner ? audio.createStereoPanner() : audio.createGain();
  if (out.pan) out.pan.value = pan;
  out.connect(masterOutput());

  // The singer, and what moves its pitch: its note (pitch), and small changes in cents (detune).
  voice = MIXED_VOICES[voice]?.lead ?? voice;
  const singer = makeVoice(audio, voice);
  const pitch = singer.pitch.offset;
  singer.detune.offset.value = detune;
  const cents = singer.detune.offset;
  if (drift) {                                             // from the middle on, it wanders further off
    const middle = starts[Math.floor(notes.length / 2)];
    cents.setValueAtTime(detune, middle);
    cents.linearRampToValueAtTime(detune + drift, starts[notes.length - 1] + lengths[notes.length - 1]);
  }
  const flutter = wobble(audio, flutterRate, FLUTTER * (voice === "bird" ? 1 : 0), cents);
  const wander = WANDER_SPEEDS.map((speed) => wobble(audio, speed * (0.75 + random() * 0.5), style.wander / WANDER_SPEEDS.length, cents));
  const [vibratoRate, vibratoCents, vibratoAfter] = style.vibrato;
  const vibrato = wobble(audio, vibratoRate * (0.95 + random() * 0.1), 0, cents);
  const trill = wobble(audio, TRILL_RATE, 0, cents);
  const pipping = audio.createGain();                      // the quick pips of a bird's trill (normally open)
  const pipsLfo = wobble(audio, PIPS_RATE * (0.9 + random() * 0.2), 0, pipping.gain, "square");
  const tremble = audio.createGain();
  tremble.gain.value = 1 - TREMBLE;
  const trembling = wobble(audio, TREMBLE_RATE, voice === "bird" ? TREMBLE : 0, tremble.gain);
  const loudness = audio.createGain();
  loudness.gain.value = SILENT;                            // silent from the very first moment (no thump)
  loudness.gain.setValueAtTime(SILENT, start);

  let time = start;
  notes.forEach((note, i) => {
    time = starts[i];
    const target = pitches[i];
    const isLast = i === notes.length - 1;
    const length = lengths[i];
    pitch.setValueAtTime(target * style.glide, time);
    pitch.exponentialRampToValueAtTime(target, time + style.glideTime);
    if (i + 1 <= joinsAt) { time += length; return; }    // not joined yet: silent
    if (joinsAt > 0 && i === Math.floor(joinsAt)) {      // joining partway through this note: fade in gently
      const joinAt = time + (joinsAt - i) * length;
      loudness.gain.setValueAtTime(SILENT, joinAt);
      loudness.gain.exponentialRampToValueAtTime(volume, joinAt + fadeIn);
      vibrato.amount.gain.setValueAtTime(0, joinAt);
      vibrato.amount.gain.linearRampToValueAtTime(vibratoCents, joinAt + fadeIn);
    } else {
      loudness.gain.exponentialRampToValueAtTime(volume, time + (i === 0 ? style.attack : 0.05));
      if (i === 0) {                                     // vibrato grows in after the start, as players do
        vibrato.amount.gain.setValueAtTime(0, time + vibratoAfter);
        vibrato.amount.gain.linearRampToValueAtTime(vibratoCents, time + vibratoAfter + 0.4);
      }
    }
    if (isLast && mergeTo) {                             // glide into the one shared note
      pitch.setValueAtTime(target, time + style.glideTime + 0.05);
      pitch.exponentialRampToValueAtTime(mergeTo * shift, time + length * CHOIR_MERGE_BY);
    }
    if (isLast && bendAtEnd) {                           // the last note bends off as it ends
      pitch.setValueAtTime(target, time + length * 0.4);
      pitch.exponentialRampToValueAtTime(target * 2 ** (bendAtEnd / 1200), time + length);
    }
    loudness.gain.exponentialRampToValueAtTime(volume * 0.75, time + length - BETWEEN_NOTES);
    loudness.gain.exponentialRampToValueAtTime(volume * 0.3, time + length);
    if (isLast && pips && style.trills && length >= 0.5) {   // a bird's trill: the long note breaks into pips
      pipping.gain.setValueAtTime(1, time + 0.15);
      pipping.gain.linearRampToValueAtTime(1 - PIPS / 2, time + 0.3);
      pipsLfo.amount.gain.setValueAtTime(0, time + 0.15);
      pipsLfo.amount.gain.linearRampToValueAtTime(PIPS / 2, time + 0.3);
    }
    if (isLast && style.trills && !mergeTo && !bendAtEnd && !pips && length >= 0.7) {   // a soft trill
      trill.amount.gain.setValueAtTime(0, time + 0.2);
      trill.amount.gain.linearRampToValueAtTime(TRILL, time + 0.4);
      trill.amount.gain.linearRampToValueAtTime(0, time + length);
    }
    time += length;
  });
  loudness.gain.exponentialRampToValueAtTime(SILENT, time + 0.2);
  singer.output.connect(tremble).connect(pipping).connect(loudness);

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
  for (const source of [...singer.sources, flutter.oscillator, vibrato.oscillator, trill.oscillator,
    trembling.oscillator, pipsLfo.oscillator, ...wander.map((w) => w.oscillator)]) {
    source.start(start);
    source.stop(end);
  }
  const total = time - audio.currentTime + 1.3;          // including the echo dying away
  return new Promise((resolve) => setTimeout(resolve, total * 1000));
}

// One bird sings the call (in the original key).
export function singTheCall(listener = null, voice = "bird") {
  return singNotes(THE_CALL, { listener, voice });
}

// The answer to the right call: the choir singing ONE call together, in the key the visitor sang it
// ("heard": the recogniser's four notes; without it, the original key). See CHOIR in the settings.
// "voice": who sings (default CHOIR_VOICE); a part can also have its own "voice".
export function singTheChoir(heard = null, listener = null, voice = CHOIR_VOICE) {
  const moveBy = heard ? 2 ** ((heard[0].semitone - 12 * Math.log2(THE_CALL[0].pitch / 440)) / 12) : 1;
  const melody = THE_CALL.map((note) => note.pitch * moveBy);
  const tonic = CALL_KEY.tonic * moveBy;
  const volume = SOUND_BOOK["signal.bird"].volume * CHOIR_VOLUME;
  return Promise.all(CHOIR.flatMap((part, number) => {
    const mixed = MIXED_VOICES[voice];
    const partVoice = part.voice ?? (mixed ? (number === 0 ? mixed.lead : mixed.others) : voice);
    return singPart(
      melody.map((pitch, i) => ({ pitch: harmonize(pitch, part.steps, tonic, CALL_KEY.scale), length: THE_CALL[i].length })),
      part,
      number,
      {
        listener,
        voice: partVoice,
        octaves: octavesIntoRange(melody, partVoice),     // the same for every singer of that voice
        volume: volume * (number === 0 ? 1 : CHOIR_OTHERS_VOLUME),   // the lead stays in front
        fadeIn: CHOIR_FADE_IN,
        mergeTo: part.merges ? melody[melody.length - 1] : null,
      },
    );
  }));
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
