// CHAPTER 2 — THE SIGNAL
//
// What starts it:  the page loading.
// What it does, in order:
//   1. THE GATE: "Enable microphone". Pressing it asks the browser for the microphone. Only once
//      the microphone is really working does the page go on; if the visitor says no, or there's
//      no microphone, it says why and how to fix it, and waits.
//      (Safari: the sound system and the microphone are both started inside the button press,
//      which is what Safari requires.)
//   2. THE MOCKINGJAY: the whole page listens, constantly, and draws what it hears
//      (voice_geometry.js). listen_for_the_call.js recognises the call.
//   3. Once the call is heard: the mockingjay sings it back, everything turns gold, the page goes
//      dark, and the next chapter opens.
// What changes:    the site is told this chapter is finished.

import { soundSystem } from "../shared/sounds.js";
import { finishChapterAndGoOn } from "../shared/tell_the_site.js";
import { singTheCall } from "./bird_song.js";
import { startListening } from "./listen_for_the_call.js";
import { makeVoiceGeometry } from "./voice_geometry.js";

const BIRD_ANSWERS_AFTER = 600;     // ms between hearing the call and the bird singing it back
const DARK_FOR = 1600;              // ms of fading to black before the next chapter

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
function startTheMockingjay(audio, stream) {
  scene.classList.add("is-listening");
  const geometry = makeVoiceGeometry(document.getElementById("voice-geometry"), document.getElementById("mockingjay"));
  const listening = startListening(audio, stream, {
    onFrame: (report) => geometry.report(report),
    onHeard: () => theBirdAnswers(audio, geometry),
  });
  geometry.show(listening.ears);
}

// ---- 3. The answer, then dark ---------------------------------------------------------------------
async function theBirdAnswers(audio, geometry) {
  scene.classList.add("has-answered");
  geometry.turnGold();
  await wait(BIRD_ANSWERS_AFTER);
  const birdEars = audio.createAnalyser();      // so the drawing traces the bird's song
  birdEars.fftSize = 2048;
  geometry.show(birdEars);
  await singTheCall(birdEars);
  document.querySelector(".blackout").classList.add("is-dark");
  await wait(DARK_FOR);
  await finishChapterAndGoOn("signal");
}

button.addEventListener("click", turnOnTheMicrophone);
