// THE BIRD'S SONG — the mockingjay sings the four-note call, made on the spot (no recording).
//
// What starts it:  signal.js, to teach the call ("hear the call") and when the bird answers.
// What it does:    plays THE_CALL as a soft whistle: a pure tone with a little vibrato, each note
//                  gliding into the next, with an echo, like a bird in a wide valley.
//                  It also feeds the sound to the voice line, so the line traces the song.
// What it gives back: a promise that finishes when the song (and its echo) has faded.

import { soundSystem } from "../shared/sounds.js";

// The call: four notes, in hertz, and how long each lasts (seconds).
// (G, B-flat, A, D, an octave up: birds whistle high.)
export const THE_CALL = [
  { pitch: 783.99, length: 0.42 },   // G
  { pitch: 932.33, length: 0.42 },   // B-flat
  { pitch: 880.0, length: 0.42 },    // A
  { pitch: 587.33, length: 0.95 },   // D, held
];
const GLIDE = 0.05;                  // seconds to slide from one note to the next
const ECHO_DELAY = 0.32;
const ECHO_STRENGTH = 0.35;

// Sing the call. "listener" is an optional AnalyserNode (the voice line) that hears the song too.
export function singTheCall(listener = null, { volume = 0.22 } = {}) {
  const audio = soundSystem();
  const start = audio.currentTime + 0.05;

  const whistle = audio.createOscillator();
  whistle.type = "sine";
  const vibrato = audio.createOscillator();      // a slow wobble in pitch makes it sound alive
  vibrato.frequency.value = 6.2;
  const vibratoDepth = audio.createGain();
  vibratoDepth.gain.value = 9;                   // hertz up and down
  vibrato.connect(vibratoDepth).connect(whistle.frequency);

  const loudness = audio.createGain();
  loudness.gain.setValueAtTime(0.0001, start);
  let time = start;
  for (const [i, note] of THE_CALL.entries()) {
    if (i === 0) whistle.frequency.setValueAtTime(note.pitch, time);
    else whistle.frequency.exponentialRampToValueAtTime(note.pitch, time + GLIDE);
    // Each note swells in and eases off a little, without stopping between notes.
    loudness.gain.exponentialRampToValueAtTime(volume, time + 0.06);
    loudness.gain.exponentialRampToValueAtTime(volume * 0.55, time + note.length - 0.02);
    time += note.length;
  }
  loudness.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);

  // The echo: a delayed, softer, slightly muffled copy that repeats once or twice.
  const echo = audio.createDelay(1);
  echo.delayTime.value = ECHO_DELAY;
  const echoFade = audio.createGain();
  echoFade.gain.value = ECHO_STRENGTH;
  const muffle = audio.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = 2400;
  echo.connect(muffle).connect(echoFade).connect(echo);   // feeds back into itself, fading each time

  whistle.connect(loudness);
  loudness.connect(audio.destination);
  loudness.connect(echo);
  echoFade.connect(audio.destination);
  if (listener) {
    loudness.connect(listener);
    echoFade.connect(listener);
  }

  whistle.start(start);
  vibrato.start(start);
  whistle.stop(time + 0.3);
  vibrato.stop(time + 0.3);
  const total = time - audio.currentTime + 1.2;            // including the echo dying away
  return new Promise((resolve) => setTimeout(resolve, total * 1000));
}
