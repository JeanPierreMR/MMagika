// LISTENING FOR THE CALL — hears the visitor through the microphone, all the time, and notices the
// moment they whistle (or hum) the mockingjay's four notes.
//
// What starts it:  signal.js, once the microphone is on. It keeps listening until the call is heard.
// What it gives back: "ears" (the sound, for the drawing), and every ~33 ms a report of what it
//   worked out (onFrame), which the drawing shows as its "calculations". onHeard() once the call is right.
// Privacy: the sound is only analysed here, in the browser, as it comes in. Nothing is recorded
// or sent anywhere.
//
// ---- HOW IT RECOGNISES THE CALL ----------------------------------------------------------------
// 1. PITCH (findPitch). About 30 times a second it takes the last ~43 ms of sound (2048 samples)
//    and asks "after how many samples does this wave repeat itself?". For every possible delay τ
//    it measures how alike the sound is to itself shifted by τ (normalised autocorrelation:
//    r(τ) = 2·Σ x[n]·x[n+τ] / Σ (x[n]² + x[n+τ]²), which is 1 for a perfect repeat). The first delay
//    where r(τ) peaks above 0.82 is one wave; the pitch is sampleRate ÷ τ (refined between samples
//    with a parabola). Delays cover 70–3500 Hz: from a low hum to a high whistle.
// 2. NOTES. Each pitch becomes a number of semitones (12·log2(f/440)). While the pitch stays within
//    SAME_NOTE of where it started, it's the same note. A note counts once it has lasted
//    SHORTEST_NOTE, and ends when the pitch moves away or goes quiet. A short wobble or a breath
//    in the middle of a note (a gap under MERGE_GAP at the same pitch) doesn't split it in two.
// 3. SHAPE. Each time a note ends, it looks at the last four notes in a row and works out the three
//    jumps between them, in semitones. The call's jumps are +3, −1, −7 (G → B♭ → A → down to D). Each jump
//    must be within TOLERANCE of those. Only the jumps matter, not the notes themselves, so any key
//    works, high or low.
// 4. RHYTHM. From the start of the first note to the end of the fourth must take between
//    SHORTEST_CALL and LONGEST_CALL seconds (2 to 6): a normal pace, not rushed, not dragged out.
// 5. It never stops listening: it keeps the last few notes and checks again every time one ends,
//    so the call is recognised whenever it comes, however much noise or whistling came before it.

import { THE_CALL } from "./bird_song.js";

const SAME_NOTE = 0.8;            // semitones: closer than this is still the same note
const SHORTEST_NOTE = 0.1;        // seconds a pitch must hold to count as a note
const MERGE_GAP = 0.18;           // seconds: a gap shorter than this, at the same pitch, is one note
const TOLERANCE = 1.6;            // semitones each jump may be off by
const SHORTEST_CALL = 2;          // seconds, whole call
const LONGEST_CALL = 6;
const QUIETEST = 0.012;           // below this loudness (RMS), it's silence

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
    if (curve[lag] > 0.82 && curve[lag] >= curve[lag - 1] && curve[lag] >= curve[lag + 1]) {
      const [a, b, c] = [curve[lag - 1], curve[lag], curve[lag + 1]];
      const shift = (a - c) / (2 * (a - 2 * b + c)) || 0;
      return { pitch: sampleRate / (lag + shift), clarity: b, loudness, curve };
    }
  }
  return { pitch: null, clarity: 0, loudness, curve };
}

// Steps 3 and 4: do these four notes make the call? Returns how far off they are.
export function compareWithTheCall(four) {
  const jumps = four.slice(1).map((note, i) => note.semitone - four[i].semitone);
  const worstJump = Math.max(...jumps.map((jump, i) => Math.abs(jump - CALL_SHAPE[i])));
  const span = four[3].end - four[0].start;
  return { jumps, worstJump, span, isTheCall: worstJump <= TOLERANCE && span >= SHORTEST_CALL && span <= LONGEST_CALL };
}

export function startListening(audio, stream, { onFrame, onHeard }) {
  const microphone = audio.createMediaStreamSource(stream);
  const ears = audio.createAnalyser();
  ears.fftSize = 2048;
  microphone.connect(ears);

  const samples = new Float32Array(ears.fftSize);
  const notes = [];                 // finished notes: { semitone, start, end }
  let current = null;               // the note being sung right now
  let lastCheck = null;             // the latest comparison, for the drawing
  let listening = true;

  function endCurrentNote() {
    if (!current || current.end - current.start < SHORTEST_NOTE) { current = null; return; }
    const previous = notes[notes.length - 1];
    if (previous && current.start - previous.end < MERGE_GAP && Math.abs(current.semitone - previous.semitone) < SAME_NOTE) {
      previous.end = current.end;                                   // a breath in the middle: same note
    } else {
      notes.push({ semitone: current.semitone, start: current.start, end: current.end });
      if (notes.length > 8) notes.shift();
    }
    current = null;
    if (notes.length >= 4) {
      lastCheck = compareWithTheCall(notes.slice(-4));
      if (lastCheck.isTheCall) {
        stop();
        onHeard();
      }
    }
  }

  function listen() {
    if (!listening) return;
    ears.getFloatTimeDomainData(samples);
    const reading = findPitch(samples, audio.sampleRate);
    const now = audio.currentTime;
    if (reading.pitch === null) {
      endCurrentNote();
    } else {
      const semitone = semitonesOf(reading.pitch);
      if (current && Math.abs(semitone - current.semitone) > SAME_NOTE) endCurrentNote();
      if (!current) current = { semitone, start: now, end: now, frames: 1 };
      else {
        current.frames++;
        current.semitone += (semitone - current.semitone) / current.frames;   // its average pitch
        current.end = now;
      }
    }
    onFrame({ ...reading, now, current, notes: notes.slice(-4), check: lastCheck });
    if (listening) setTimeout(listen, 33);
  }

  function stop() {
    listening = false;
    stream.getTracks().forEach((track) => track.stop());   // the microphone light goes off
    microphone.disconnect();
  }

  listen();
  return { ears, stop };
}
