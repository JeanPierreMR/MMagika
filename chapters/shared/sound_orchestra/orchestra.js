// THE ORCHESTRA — plays the cues listed in sound_book.js. Chapters never build sounds themselves;
// they just say  cue("vault.open")  and the orchestra does the rest.
//
// What it gives:   cue(name, options)        play a cue (a bed fades in and keeps going)
//                  stopCue(name, { fade })    fade a bed out and stop it
//                  fadeAll(seconds)           fade every bed out (e.g. as a page goes dark)
//                  duck(name, amount, seconds) dip a bed for a moment (amount < 1), or swell it (> 1)
//                  soundSystem(), masterOutput()  for the microphone and the mockingjay
// How it plays:    every cue has its own volume control, and all of them go through one master
//                  volume (MASTER_VOLUME in sound_book.js). A cue with a "file" plays that recording
//                  (loaded once, then kept); otherwise it plays its synthesized placeholder.
// When the browser holds sound back: browsers only allow sound after the visitor has touched the
//                  page. The terminal and the letter open by themselves, so there:
//                    - beds are started anyway, and fade in the moment the visitor first taps, clicks,
//                      scrolls or presses a key (nothing on screen asks them to);
//                    - one-off sounds that can't be heard right now are skipped, never played late.

import { MASTER_VOLUME, SOUND_BOOK } from "./sound_book.js";
import * as RECIPES from "./synth_recipes.js";
import { makeRandom } from "../looks_random.js";

const sliceRandom = makeRandom(404);

const SILENT = 0.0001;
const WAIT_TO_WAKE = 300;               // ms a one-off sound waits for the sound system to start
const FIRST_TOUCH = ["pointerdown", "keydown", "wheel", "touchstart"];

let audio = null;
let master = null;
const playing = new Map();              // bed name -> { level, handle, entry }
const recordings = new Map();           // file address -> promise of the decoded sound (or null)

// ---- The sound system ---------------------------------------------------------------------------
export function soundSystem() {
  if (!audio) {
    audio = new (window.AudioContext || window.webkitAudioContext)();
    master = audio.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(audio.destination);
  }
  if (audio.state === "suspended") audio.resume().catch(() => {});
  return audio;
}

export function masterOutput() {
  soundSystem();
  return master;
}

// Fade EVERYTHING out (beds and one-off sounds alike), e.g. as a page hands over to the next one.
export function fadeEverythingOut(seconds = 1.5) {
  const level = masterOutput().gain;
  level.cancelScheduledValues(audio.currentTime);
  level.setValueAtTime(level.value, audio.currentTime);
  level.linearRampToValueAtTime(0, audio.currentTime + seconds);
}

export function setMasterVolume(volume) {
  masterOutput().gain.setTargetAtTime(volume, audio.currentTime, 0.05);
}

// If the browser is holding sound back, start it on the visitor's first touch.
let waitingForTouch = false;
function wakeOnFirstTouch() {
  if (waitingForTouch) return;
  waitingForTouch = true;
  const wake = () => audio.resume().catch(() => {});
  FIRST_TOUCH.forEach((event) => window.addEventListener(event, wake, { capture: true, passive: true }));
  audio.addEventListener("statechange", () => {
    if (audio.state !== "running") return;
    FIRST_TOUCH.forEach((event) => window.removeEventListener(event, wake, { capture: true }));
    waitingForTouch = false;
  });
}

// Waits a moment for the sound system to start; says whether it did.
function awake(withinMs) {
  if (audio.state === "running") return Promise.resolve(true);
  return Promise.race([
    audio.resume().then(() => audio.state === "running").catch(() => false),
    new Promise((resolve) => setTimeout(() => resolve(audio.state === "running"), withinMs)),
  ]);
}

// ---- Making a cue's sound -----------------------------------------------------------------------
function loadRecording(file) {
  const address = new URL(file, import.meta.url).href;
  if (!recordings.has(address)) {
    recordings.set(address, fetch(address)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .then((bytes) => (bytes ? audio.decodeAudioData(bytes) : null))
      .catch(() => null));
  }
  return recordings.get(address);
}

async function makeSound(entry, out, callOptions) {
  const options = { ...entry.options, ...callOptions };   // the sound book's settings, then the page's
  if (entry.file) {
    const recording = await loadRecording(entry.file);
    if (recording) {
      const source = audio.createBufferSource();
      source.buffer = recording;
      source.loop = entry.kind === "bed" || Boolean(entry.loop);
      const when = Math.max(options.when, audio.currentTime);
      // A one-off sound given a "duration" (e.g. a glitch) plays just that slice of the recording, from a
      // different point each time (sliceRandom: the same pattern on every visit), with tiny fades.
      if (entry.kind !== "bed" && options.duration && options.duration < recording.duration) {
        const from = sliceRandom() * (recording.duration - options.duration);
        const edges = audio.createGain();
        edges.gain.setValueAtTime(0, when);
        edges.gain.linearRampToValueAtTime(1, when + 0.01);
        edges.gain.setValueAtTime(1, when + options.duration - 0.02);
        edges.gain.linearRampToValueAtTime(0, when + options.duration);
        source.connect(edges).connect(out);
        source.start(when, from, options.duration);
        return { length: options.duration, stop: (at = audio.currentTime) => { try { source.stop(at); } catch { /* done */ } } };
      }
      source.connect(out);
      source.start(when);
      return { length: recording.duration, stop: (at = audio.currentTime) => { try { source.stop(at); } catch { /* done */ } } };
    }
  }
  const recipe = RECIPES[entry.synth];
  if (!recipe) return { length: 0 };
  return recipe(audio, out, { ...entry.options, ...options });
}

// ---- Playing cues -------------------------------------------------------------------------------
export function cue(name, options = {}) {
  const entry = SOUND_BOOK[name];
  if (!entry || entry.kind === "voice") {
    if (!entry) console.warn(`No sound called "${name}" in sound_book.js`);
    return Promise.resolve();
  }
  soundSystem();
  if (audio.state !== "running") wakeOnFirstTouch();
  return entry.kind === "bed" ? startBed(name, entry, options) : playOnce(entry, options);
}

async function startBed(name, entry, options) {
  if (playing.has(name)) return;
  const level = audio.createGain();
  level.gain.setValueAtTime(SILENT, audio.currentTime);
  level.gain.linearRampToValueAtTime(entry.volume, audio.currentTime + (entry.fadeIn ?? 1));
  level.connect(master);
  const record = { level, handle: null, entry };
  playing.set(name, record);
  record.handle = await makeSound(entry, level, { when: audio.currentTime, ...options });
  if (playing.get(name) !== record) record.handle?.stop?.();    // stopped while it was loading
}

async function playOnce(entry, options) {
  if (!(await awake(WAIT_TO_WAKE))) return;                     // can't be heard now: skip it
  const level = audio.createGain();
  level.gain.value = entry.volume;
  level.connect(master);
  const delay = options.delay ?? 0;
  const handle = await makeSound(entry, level, { when: audio.currentTime + delay, ...options });
  const seconds = delay + (handle.length ?? 0);
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  setTimeout(() => level.disconnect(), 3000);                   // after any echo has died away
}

export function stopCue(name, { fade } = {}) {
  const record = playing.get(name);
  if (!record) return;
  playing.delete(name);
  const seconds = fade ?? record.entry.fadeOut ?? 1;
  const now = audio.currentTime;
  record.level.gain.cancelScheduledValues(now);
  record.level.gain.setValueAtTime(Math.max(record.level.gain.value, SILENT), now);
  record.level.gain.linearRampToValueAtTime(SILENT, now + seconds);
  setTimeout(() => {
    record.handle?.stop?.();
    record.level.disconnect();
  }, (seconds + 0.1) * 1000);
}

export function fadeAll(seconds = 1) {
  [...playing.keys()].forEach((name) => stopCue(name, { fade: seconds }));
}

export function duck(name, amount, seconds = 0.6) {
  const record = playing.get(name);
  if (!record) return;
  const now = audio.currentTime;
  const volume = record.entry.volume;
  record.level.gain.cancelScheduledValues(now);
  record.level.gain.setValueAtTime(Math.max(record.level.gain.value, SILENT), now);
  record.level.gain.linearRampToValueAtTime(volume * amount, now + 0.08);
  record.level.gain.linearRampToValueAtTime(volume, now + 0.08 + seconds);
}

// For the sound lab: forget a loaded recording (after a new file of the same name is uploaded).
export function forgetRecording(file) {
  recordings.delete(new URL(file, import.meta.url).href);
}

// For the sound lab: is a bed playing, and follow a changed volume in the sound book.
export function isPlaying(name) {
  return playing.has(name);
}

export function followVolume(name) {
  const record = playing.get(name);
  if (record) record.level.gain.setTargetAtTime(record.entry.volume, audio.currentTime, 0.05);
}
