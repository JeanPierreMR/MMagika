// LISTENING FOR THE CALL — hears the visitor through the microphone, all the time, and notices the
// moment they whistle or HUM the mockingjay's four notes. When they sing four notes that aren't the
// call, it says so too, so the bird can mirror them back.
//
// What starts it:  signal.js, once the microphone is on. It keeps listening until the call is heard.
//   It also watches the microphone itself: if it's unplugged or switched off, onLost() says so.
// What it gives back: "ears" (the sound, for the drawing), pauseFor(ms) (stop listening for a moment,
//   e.g. while the bird sings, so it doesn't hear itself), and every ~33 ms a report of what it worked
//   out (onFrame), which the drawing shows. onHeard(notes) once the call is right (with the four notes
//   heard, so the birds can answer in the visitor's key); onMirror(notes) when the
//   visitor sang four notes that weren't the call.
// Privacy: the sound is only analysed here, in the browser, as it comes in. Nothing is recorded
// or sent anywhere.
//
// ---- HOW IT RECOGNISES THE CALL ----------------------------------------------------------------
// 1. PITCH (findPitch). About 30 times a second it takes the last ~43 ms of sound (2048 samples)
//    and asks "after how many samples does this wave repeat itself?". For every possible delay τ
//    it measures how alike the sound is to itself shifted by τ (normalised autocorrelation:
//    r(τ) = 2·Σ x[n]·x[n+τ] / Σ (x[n]² + x[n+τ]²), which is 1 for a perfect repeat). The first delay
//    where r(τ) peaks above CLARITY is one wave; the pitch is sampleRate ÷ τ (refined between samples
//    with a parabola). Delays cover 70–3500 Hz: from a low hum to a high whistle.
// 2. NOTES. Each pitch becomes a number of semitones (12·log2(f/440)). While the pitch stays within
//    SAME_NOTE of where it started, it's the same note. A note counts once it has lasted
//    SHORTEST_NOTE, and ends when the pitch moves away or goes quiet. A tiny dropout in the middle
//    of a note (under MERGE_GAP, same pitch) doesn't split it. A hum often fools the pitch-finder by
//    exactly an octave for a moment; a jump of about ±12 semitones inside a note is ignored.
// 3. SHAPE. Each time a note ends, it looks at the last four notes in a row and works out the three
//    jumps between them, in semitones. The call's jumps are +3, −1, −7 (G → B♭ → A → down to D). Each
//    jump must be within TOLERANCE of those. Only the jumps matter, not the notes themselves, so any
//    key works, high or low, hummed or whistled.
// 4. RHYTHM. From the start of the first note to the end of the fourth must take between
//    SHORTEST_CALL and LONGEST_CALL seconds: a normal pace, not rushed, not dragged out.
// 5. It never stops listening: it keeps the last few notes and checks again every time one ends.
// 6. MIRRORING. A "phrase" is notes sung with short gaps between them. When a phrase of at least four
//    notes ends (PHRASE_END seconds of quiet) and it wasn't the call, onMirror gets its last four
//    notes — at most once every MIRROR_COOLDOWN seconds, so it stays gentle.

import { PitchDetector } from "../shared/vendor/pitchy/pitchy.js";
import { THE_CALL } from "./bird_song.js";

// WHICH PITCH-FINDER the page uses (step 1 below). Compare them live in the sound lab.
//   "autocorrelation"  our own, described in step 1
//   "mcleod"           the McLeod Pitch Method, from the pitchy library (shared/vendor/pitchy/): a refined
//                      version of the same idea, built for tuners and singing; usually steadier on hums
export const PITCH_FINDER = "mcleod";      // chosen after comparing in the lab: steadier and ~5× less work

// How forgiving it is. Bigger numbers = easier.
const CLARITY = 0.7;              // how clearly a sound must repeat to count as a pitch (a hum is breathy)
const SAME_NOTE = 0.8;            // semitones: closer than this is still the same note. Keep it under 1:
                                  //   the call has a one-semitone step (B♭ → A) that must split two notes.
const SHORTEST_NOTE = 0.12;       // seconds a pitch must hold to count as a note
const MERGE_GAP = 0.1;            // seconds: a dropout shorter than this, at the same pitch, is one note
const OCTAVE_SLIP = 0.7;          // semitones around ±12 treated as the pitch-finder slipping an octave
const TOLERANCE = 2.5;            // semitones each jump may be off by
const SHORTEST_CALL = 1.5;        // seconds, whole call
const LONGEST_CALL = 7;
const QUIETEST = 0.008;           // below this loudness (RMS), it's silence
const PHRASE_END = 1.1;           // seconds of quiet that end a phrase (then a wrong phrase is mirrored)
const MIRROR_COOLDOWN = 5;        // seconds: the bird mirrors at most this often
const MUTED_TOO_LONG = 4000;      // ms a microphone may stay muted before it counts as disconnected

export const semitonesOf = (pitch) => 12 * Math.log2(pitch / 440);
// The call's shape: the jumps between its notes, in semitones (+3, −1, −7).
export const CALL_SHAPE = THE_CALL.slice(1).map((note, i) => semitonesOf(note.pitch) - semitonesOf(THE_CALL[i].pitch));
export const CALL_TIMING = [SHORTEST_CALL, LONGEST_CALL];

// Step 1: the pitch of a short slice of sound. Returns { pitch (Hz or null), clarity (best r(τ)),
// loudness (RMS), curve (r(τ) for every delay, for the drawing) }.
export function findPitch(samples, sampleRate) {
  let energy = 0;
  for (const s of samples) energy += s * s;
  const loudness = Math.sqrt(energy / samples.length);
  const minLag = Math.floor(sampleRate / 3500);
  const maxLag = Math.floor(sampleRate / 70);
  const curve = new Float32Array(maxLag + 2);
  if (loudness < QUIETEST) return { pitch: null, clarity: 0, loudness, curve };

  const size = samples.length / 2;
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let sum = 0, both = 0;
    for (let i = 0; i < size; i++) {
      sum += samples[i] * samples[i + lag];
      both += samples[i] * samples[i] + samples[i + lag] * samples[i + lag];
    }
    curve[lag] = both ? (2 * sum) / both : 0;
  }
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    if (curve[lag] > CLARITY && curve[lag] >= curve[lag - 1] && curve[lag] >= curve[lag + 1]) {
      const [a, b, c] = [curve[lag - 1], curve[lag], curve[lag + 1]];
      const shift = (a - c) / (2 * (a - 2 * b + c)) || 0;
      return { pitch: sampleRate / (lag + shift), clarity: b, loudness, curve };
    }
  }
  return { pitch: null, clarity: 0, loudness, curve };
}

// Step 1, the other way: the McLeod Pitch Method (pitchy). Same answer shape as findPitch, so either can
// be used. Its "curve" is the method's own similarity curve (the normalised square difference), for the
// drawing. Like ours, it only counts a pitch that is clear enough (CLARITY) and between 70 and 3500 Hz.
const mcleodDetectors = new Map();          // one per slice length, made once
export function findPitchMcLeod(samples, sampleRate) {
  let energy = 0;
  for (const s of samples) energy += s * s;
  const loudness = Math.sqrt(energy / samples.length);
  if (!mcleodDetectors.has(samples.length)) mcleodDetectors.set(samples.length, PitchDetector.forFloat32Array(samples.length));
  const detector = mcleodDetectors.get(samples.length);
  if (loudness < QUIETEST) return { pitch: null, clarity: 0, loudness, curve: null };
  const [pitch, clarity] = detector.findPitch(samples, sampleRate);
  const curve = detector._nsdfBuffer.slice(0, Math.floor(sampleRate / 70) + 2);
  const usable = pitch >= 70 && pitch <= 3500 && clarity > CLARITY;
  return { pitch: usable ? pitch : null, clarity: usable ? clarity : 0, loudness, curve };
}

export const PITCH_FINDERS = { autocorrelation: findPitch, mcleod: findPitchMcLeod };

// Steps 3 and 4: do these four notes make the call? Returns how far off they are.
export function compareWithTheCall(four) {
  const jumps = four.slice(1).map((note, i) => note.semitone - four[i].semitone);
  const worstJump = Math.max(...jumps.map((jump, i) => Math.abs(jump - CALL_SHAPE[i])));
  const span = four[3].end - four[0].start;
  return { jumps, worstJump, span, isTheCall: worstJump <= TOLERANCE && span >= SHORTEST_CALL && span <= LONGEST_CALL };
}

// Steps 2 to 6, without the microphone: feed it, moment by moment, a time (seconds) and the pitch heard
// then (in semitones, or null for quiet). It calls onHeard(four notes) once the call is sung, and onMirror(four
// notes) when a wrong phrase ends. Kept separate so it can be tested with made-up notes (sound lab).
export function makeNoteTracker({ onHeard, onMirror = () => {} }) {
  const notes = [];                 // finished notes: { semitone, start, end }
  let phrase = [];                  // the notes of the phrase being sung
  let phraseDone = false;
  let current = null;               // the note being sung right now
  let lastCheck = null;             // the latest comparison, for the drawing
  let lastMirrorAt = -Infinity;
  let deafUntil = -Infinity;
  let finished = false;

  function endCurrentNote() {
    if (!current || current.end - current.start < SHORTEST_NOTE) { current = null; return; }
    const previous = notes[notes.length - 1];
    if (previous && current.start - previous.end < MERGE_GAP && Math.abs(current.semitone - previous.semitone) < SAME_NOTE) {
      previous.end = current.end;                                   // a dropout in the middle: same note
    } else {
      const note = { semitone: current.semitone, start: current.start, end: current.end };
      if (phrase.length && note.start - phrase[phrase.length - 1].end > PHRASE_END) {
        phrase = [];                                                // a new phrase begins
        phraseDone = false;
      }
      notes.push(note);
      phrase.push(note);
      if (notes.length > 8) notes.shift();
    }
    current = null;
    if (notes.length >= 4) {
      lastCheck = compareWithTheCall(notes.slice(-4));
      if (lastCheck.isTheCall) {
        finished = true;
        onHeard(notes.slice(-4));
      }
    }
  }

  function maybeMirror(now) {
    if (phraseDone || phrase.length < 4 || now - phrase[phrase.length - 1].end < PHRASE_END) return;
    phraseDone = true;
    if (now - lastMirrorAt < MIRROR_COOLDOWN) return;
    lastMirrorAt = now;
    onMirror(phrase.slice(-4));
  }

  function feed(now, semitone) {
    if (finished) return;
    if (now < deafUntil) { current = null; return; }
    if (semitone === null) {
      endCurrentNote();
      if (!finished) maybeMirror(now);
      return;
    }
    if (current) {
      const jump = semitone - current.semitone;
      if (Math.abs(Math.abs(jump) - 12) < OCTAVE_SLIP) { current.end = now; return; }   // an octave slip
      if (Math.abs(jump) > SAME_NOTE) endCurrentNote();
      if (finished) return;
    }
    if (!current) current = { semitone, start: now, end: now, frames: 1 };
    else {
      current.frames++;
      current.semitone += (semitone - current.semitone) / current.frames;   // its average pitch
      current.end = now;
    }
  }

  // Stop hearing until a given time (e.g. while the bird sings), and forget the unfinished phrase.
  function deafen(until) {
    deafUntil = until;
    current = null;
    phrase = [];
    phraseDone = false;
  }

  return {
    feed,
    deafen,
    stop() { finished = true; },
    report: () => ({ current, notes: notes.slice(-4), check: lastCheck }),
  };
}

// Options: pitchFinder "autocorrelation" or "mcleod" (default PITCH_FINDER); alsoTry: the other one too,
// on the very same sound, for comparing (its reading comes in the frame report as "other").
// onLost: the microphone stopped by itself (unplugged, switched off, permission taken back). It's called
// once; listening has not been stopped yet, so call stop() and start again with a new microphone.
export function startListening(audio, stream, { onFrame, onHeard, onMirror, onLost = () => {}, pitchFinder = PITCH_FINDER, alsoTry = null }) {
  const findThePitch = PITCH_FINDERS[pitchFinder];
  const findTheOther = alsoTry ? PITCH_FINDERS[alsoTry] : null;
  const microphone = audio.createMediaStreamSource(stream);
  const ears = audio.createAnalyser();
  ears.fftSize = 2048;
  microphone.connect(ears);

  const samples = new Float32Array(ears.fftSize);
  let listening = true;
  const tracker = makeNoteTracker({
    onHeard: (four) => { stop(); onHeard(four); },
    onMirror,
  });

  function listen() {
    if (!listening) return;
    ears.getFloatTimeDomainData(samples);
    const reading = findThePitch(samples, audio.sampleRate);
    const now = audio.currentTime;
    tracker.feed(now, reading.pitch === null ? null : semitonesOf(reading.pitch));
    const other = findTheOther ? findTheOther(samples, audio.sampleRate) : null;
    onFrame({ ...reading, now, other, ...tracker.report() });
    if (listening) setTimeout(listen, 33);
  }

  // ---- Is the microphone still there? ----------------------------------------------------------
  // A microphone that is unplugged or switched off "ends"; some browsers only "mute" it (silence).
  // Muting also happens for a moment by itself (e.g. the tab going to the background on a phone), so
  // it only counts as lost if it stays muted for MUTED_TOO_LONG while the page is on screen.
  const tracks = stream.getAudioTracks();
  let lost = false;
  let mutedTimer = null;
  function lose() {
    if (lost || !listening) return;
    lost = true;
    onLost();
  }
  function watchMuting() {
    clearTimeout(mutedTimer);
    if (!tracks.some((track) => track.muted)) return;
    mutedTimer = setTimeout(() => {
      if (document.visibilityState === "visible" && tracks.some((track) => track.muted)) lose();
    }, MUTED_TOO_LONG);
  }
  // Coming back to the page: phones pause the sound system in the background; start it again.
  function wakeUp() {
    if (!listening || document.visibilityState !== "visible") return;
    if (audio.state !== "running") audio.resume().catch(() => {});
    watchMuting();
  }
  for (const track of tracks) {
    track.addEventListener("ended", lose);
    track.addEventListener("mute", watchMuting);
    track.addEventListener("unmute", watchMuting);
  }
  document.addEventListener("visibilitychange", wakeUp);
  audio.addEventListener("statechange", wakeUp);

  function stop() {
    listening = false;
    tracker.stop();
    clearTimeout(mutedTimer);
    document.removeEventListener("visibilitychange", wakeUp);
    audio.removeEventListener("statechange", wakeUp);
    stream.getTracks().forEach((track) => track.stop());   // the microphone light goes off
    microphone.disconnect();
  }

  listen();
  return {
    ears,
    stop,
    pauseFor: (ms) => tracker.deafen(audio.currentTime + ms / 1000),
  };
}
