// CHAPTER 2 — THE SIGNAL
//
// What starts it:  the page loading.
// What it does, in order:
//   1. THE GATE: "Enable microphone". Pressing it asks the browser for the microphone. Only once
//      the microphone is really working does the page go on; if the visitor says no, or there's
//      no microphone, it says why and how to fix it, and waits.
//      (Safari: the sound system and the microphone are both started inside the button press,
//      which is what Safari requires.)
//   2. THE MOCKINGJAY: the forest fades in, and the whole page listens, constantly, and draws what it
//      hears (voice_geometry.js). listen_for_the_call.js recognises the call. If the visitor sings
//      four notes that aren't the call, a few birds whistle them back, a little off (out of tune and
//      time, the last note bending flat), and it listens again soon after (WRONG_TUNE in bird_song.js).
//      If the microphone is unplugged or switched off meanwhile, the gate comes back and says so.
//   3. Once the call is heard: a choir answers with the call in harmony, in the key the visitor sang
//      (CHOIR in bird_song.js); everything turns gold, the page goes dark (the forest fades with it), and the
//      next chapter opens.
// Sounds: "signal.*" in shared/sound_orchestra/sound_book.js.
// What changes:    the site is told this chapter is finished.

import { cue, duck, fadeAll, fetchSoundsAhead, preloadSounds, soundSystem } from "../shared/sound_orchestra/orchestra.js";
import { finishChapterAndGoOn } from "../shared/tell_the_site.js";
import { mirrorTheWrongTune, notesFromVoice, singTheChoir, wrongTuneLength } from "./bird_song.js";
import { startListening } from "./listen_for_the_call.js";
import { makeVoiceGeometry } from "./voice_geometry.js";

const BIRD_ANSWERS_AFTER = 600;     // ms between hearing the call and the bird singing it back
const DARK_FOR = 1600;              // ms of fading to black before the next chapter
const MIRROR_AFTER = 350;           // ms of quiet before the bird mirrors the visitor's notes

const scene = document.getElementById("signal-scene");
const gate = document.getElementById("microphone-gate");
const gateMessage = document.getElementById("gate-message");
const button = document.getElementById("turn-on-microphone");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// What to tell the visitor when the microphone can't start, by the browser's reason.
function whyItFailed(error) {
  if (!navigator.mediaDevices?.getUserMedia) return "This page needs a secure (https) connection to use the microphone.";
  if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
    return "The microphone is blocked. Allow it for this site in your browser (in Safari: Settings for this website → Microphone → Allow), then press the button again.";
  }
  if (error?.name === "NotFoundError" || error?.name === "OverconstrainedError") return "No microphone was found. Connect one and press the button again.";
  return "The microphone couldn't start. Press the button to try again.";
}

// ---- 1. The gate ----------------------------------------------------------------------------------
async function turnOnTheMicrophone() {
  button.disabled = true;
  gateMessage.textContent = "";
  // Both must start inside the button press (Safari is strict about this).
  const audio = soundSystem();
  let stream;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("no getUserMedia");
    // Echo cancelling and noise suppression would flatten a whistle, so they're off.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    await audio.resume();
  } catch (error) {
    gateMessage.textContent = whyItFailed(error);
    button.disabled = false;
    return;
  }
  // The microphone is live only if a track is actually running.
  if (!stream.getAudioTracks().some((track) => track.readyState === "live")) {
    gateMessage.textContent = whyItFailed(null);
    button.disabled = false;
    return;
  }
  gate.classList.add("is-gone");
  startTheMockingjay(audio, stream);
}

// ---- 2. Listening ---------------------------------------------------------------------------------
let listening = null;
let geometry = null;                // the drawing: made once, even if the microphone is started again
let answered = false;
let mirroring = false;

function startTheMockingjay(audio, stream) {
  scene.classList.add("is-listening");
  cue("signal.forest");
  geometry ??= makeVoiceGeometry(document.getElementById("voice-geometry"), document.getElementById("mockingjay"));
  listening = startListening(audio, stream, {
    onFrame: (report) => geometry.report(report),
    onHeard: (heard) => theBirdsAnswer(audio, geometry, heard),
    onMirror: (heard) => theBirdMirrors(heard),
    onLost: theMicrophoneIsLost,
  });
  geometry.show(listening.ears);
}

// The microphone stopped by itself (unplugged, switched off, permission taken back): the gate comes
// back and says so. Pressing the button starts listening again, with whatever microphone is there now.
function theMicrophoneIsLost() {
  if (answered) return;
  listening.stop();
  gateMessage.textContent = "The microphone was disconnected. Connect it again and press the button.";
  button.disabled = false;
  gate.classList.remove("is-gone");
  button.focus();
}

// Four notes that weren't the call: a few birds whistle them back, a little off (WRONG_TUNE in bird_song.js).
// The listening is paused meanwhile, so it doesn't hear the bird (or the low notes).
async function theBirdMirrors(heard) {
  if (answered || mirroring) return;
  mirroring = true;
  const notes = notesFromVoice(heard);
  listening.pauseFor(MIRROR_AFTER + wrongTuneLength(notes) * 1000);
  await wait(MIRROR_AFTER);
  if (!answered) await mirrorTheWrongTune(notes);   // timings and voices: the settings in bird_song.js
  mirroring = false;
}

// ---- 3. The answer, then dark ---------------------------------------------------------------------
async function theBirdsAnswer(audio, geometry, heard) {
  answered = true;
  scene.classList.add("has-answered");
  duck("signal.forest", 1.5, 3);                // the forest swells a little with the answer
  geometry.turnGold();
  await wait(BIRD_ANSWERS_AFTER);
  const birdEars = audio.createAnalyser();      // so the drawing traces the bird's song
  birdEars.fftSize = 2048;
  geometry.show(birdEars);
  await singTheChoir(heard, birdEars);             // birds joining one every second, in harmony
  document.querySelector(".blackout").classList.add("is-dark");
  fadeAll(DARK_FOR / 1000);                     // the forest fades with the page
  await wait(DARK_FOR);
  await finishChapterAndGoOn("signal");
}

preloadSounds("signal.");                       // the forest is ready when the microphone comes on
fetchSoundsAhead("terminal.", "letter.");       // and the next chapters' sounds are on their way
button.addEventListener("click", turnOnTheMicrophone);
