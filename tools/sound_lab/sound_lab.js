// THE SOUND LAB — plays every cue in the sound book, the mockingjay, and tests the recogniser.
// It imports the site's own code, so it always sounds exactly like the site.

import { MASTER_VOLUME, SOUND_BOOK } from "/chapters/shared/sound_orchestra/sound_book.js";
import { cue, fadeAll, followVolume, isPlaying, setMasterVolume, soundSystem, stopCue } from "/chapters/shared/sound_orchestra/orchestra.js";
import { notesFromVoice, singNotes, singTheCall, songLength } from "/chapters/signal/bird_song.js";
import { CALL_SHAPE, CALL_TIMING, compareWithTheCall, makeNoteTracker, semitonesOf, startListening } from "/chapters/signal/listen_for_the_call.js";

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- Note names <-> pitches ---------------------------------------------------------------------
const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function pitchOf(name) {                                    // "Bb4" -> hertz
  const match = name.trim().match(/^([A-Ga-g])([#b]?)(-?\d)$/);
  if (!match) return null;
  const step = STEPS[match[1].toUpperCase()] + (match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0);
  const midi = (Number(match[3]) + 1) * 12 + step;
  return 440 * 2 ** ((midi - 69) / 12);
}
function nameOf(semitone) {                                 // semitones from A4 -> "Bb4 +12¢"
  const midi = Math.round(semitone) + 69;
  const cents = Math.round((semitone - Math.round(semitone)) * 100);
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}${cents ? ` ${cents > 0 ? "+" : ""}${cents}¢` : ""}`;
}

// ---- Master volume and buttons in the header ----------------------------------------------------
$("master").value = MASTER_VOLUME;
$("master-value").textContent = MASTER_VOLUME;
$("master").addEventListener("input", () => {
  setMasterVolume(Number($("master").value));
  $("master-value").textContent = $("master").value;
});
$("stop-all").addEventListener("click", () => { fadeAll(1); refreshButtons(); });
$("copy").addEventListener("click", async () => {
  const settings = Object.fromEntries(Object.entries(SOUND_BOOK).map(([name, entry]) => [
    name, Object.fromEntries(["volume", "fadeIn", "fadeOut"].filter((key) => key in entry).map((key) => [key, entry[key]])),
  ]));
  const text = JSON.stringify(settings, null, 1);
  try { await navigator.clipboard.writeText(text); $("copied").textContent = "Copied: paste the numbers into sound_book.js"; }
  catch { console.log(text); $("copied").textContent = "Couldn't copy: printed in the console instead"; }
});

// ---- One row per cue ------------------------------------------------------------------------------
const playButtons = new Map();
function refreshButtons() {
  for (const [name, button] of playButtons) {
    const entry = SOUND_BOOK[name];
    if (entry.kind !== "bed") continue;
    setTimeout(() => {
      button.textContent = isPlaying(name) ? "■ stop" : "▶ play";
      button.classList.toggle("on", isPlaying(name));
    }, 50);
  }
}

function numberInput(entry, key, name) {
  if (!(key in entry)) return document.createTextNode("–");
  const input = Object.assign(document.createElement("input"), { type: "number", min: 0, max: 20, step: 0.1, value: entry[key] });
  input.addEventListener("input", () => { entry[key] = Number(input.value); followVolume(name); });
  return input;
}

for (const [name, entry] of Object.entries(SOUND_BOOK)) {
  const row = document.createElement("tr");
  const play = document.createElement("button");
  play.type = "button";
  play.textContent = "▶ play";
  playButtons.set(name, play);
  play.addEventListener("click", async () => {
    soundSystem();
    if (entry.kind === "voice") return singTheCall();
    if (entry.kind === "bed") {
      if (isPlaying(name)) stopCue(name); else cue(name);
      return refreshButtons();
    }
    cue(name);
  });
  const volume = Object.assign(document.createElement("input"), { type: "range", min: 0, max: 1, step: 0.01, value: entry.volume });
  const volumeValue = document.createElement("output");
  volumeValue.textContent = entry.volume;
  volume.addEventListener("input", () => {
    entry.volume = Number(volume.value);
    volumeValue.textContent = volume.value;
    followVolume(name);
  });
  const cells = [
    Object.assign(document.createElement("td"), { className: "name", textContent: name }),
    Object.assign(document.createElement("td"), { textContent: entry.kind + (entry.file ? " · file" : entry.synth ? " · synth" : "") }),
    document.createElement("td"),
    document.createElement("td"),
    document.createElement("td"),
    document.createElement("td"),
    Object.assign(document.createElement("td"), { className: "where", textContent: entry.where }),
  ];
  cells[2].append(play);
  cells[3].append(volume, " ", volumeValue);
  cells[4].append(numberInput(entry, "fadeIn", name));
  cells[5].append(numberInput(entry, "fadeOut", name));
  row.append(...cells);
  $("cues").tBodies[0].append(row);
}

// ---- The mockingjay ------------------------------------------------------------------------------
function typedNotes() {
  const pitches = $("mirror-notes").value.split(/[\s,]+/).filter(Boolean).map(pitchOf);
  if (pitches.some((pitch) => !pitch)) { alert("Use note names like G4, Bb4, F#3"); return null; }
  return pitches.map((pitch, i) => ({ pitch, length: i === pitches.length - 1 ? 0.7 : 0.4 }));
}
$("sing-call").addEventListener("click", () => { soundSystem(); singTheCall(); });
$("sing-mirror").addEventListener("click", () => { soundSystem(); const notes = typedNotes(); if (notes) singNotes(notes); });
$("not-quite").addEventListener("click", () => { soundSystem(); cue("signal.not_quite"); });
$("mirror-and-not-quite").addEventListener("click", async () => {
  soundSystem();
  const notes = typedNotes();
  if (!notes) return;
  await singNotes(notes);
  cue("signal.not_quite");
});

// ---- The microphone test -------------------------------------------------------------------------
$("r-target").textContent = CALL_SHAPE.map((jump) => (jump > 0 ? "+" : "") + jump.toFixed(1)).join("  ");
$("r-window").textContent = `${CALL_TIMING[0]}–${CALL_TIMING[1]} s`;

function logEvent(text, kind = "") {
  const item = Object.assign(document.createElement("li"), { textContent: `${new Date().toLocaleTimeString()}  ${text}`, className: kind });
  $("events").prepend(item);
}

function showReport(report) {
  $("r-pitch").textContent = report.pitch ? `${report.pitch.toFixed(1)} Hz · ${nameOf(semitonesOf(report.pitch))}` : "–";
  $("r-clarity").textContent = report.clarity ? report.clarity.toFixed(2) : "–";
  $("r-loud").textContent = report.loudness.toFixed(3);
  $("r-notes").textContent = report.notes.length ? report.notes.map((note) => nameOf(note.semitone)).join("  ") : "–";
  if (report.check) {
    $("r-jumps").textContent = report.check.jumps.map((jump) => (jump > 0 ? "+" : "") + jump.toFixed(1)).join("  ") + `  (worst off by ${report.check.worstJump.toFixed(1)})`;
    $("r-span").textContent = `${report.check.span.toFixed(2)} s`;
  }
}

let micListening = null;
$("mic").addEventListener("click", async () => {
  if (micListening) { micListening.stop(); micListening = null; $("mic").textContent = "Start listening"; return; }
  const audio = soundSystem();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    await audio.resume();
  } catch (error) {
    logEvent(`microphone didn't start: ${error.name || error}`);
    return;
  }
  $("mic").textContent = "Stop listening";
  logEvent("listening… hum or whistle the call");
  let mirroring = false;
  micListening = startListening(audio, stream, {
    onFrame: showReport,
    onHeard: async () => {
      logEvent("✓ the call! (the bird answers)", "heard");
      micListening = null;
      $("mic").textContent = "Start listening";
      await singTheCall();
    },
    onMirror: async (heard) => {
      logEvent(`four other notes: ${heard.map((note) => nameOf(note.semitone)).join(" ")}`, "mirror");
      if (!$("mic-mirror").checked || mirroring) return;
      mirroring = true;
      const notes = notesFromVoice(heard);
      micListening?.pauseFor(350 + songLength(notes) * 1000 + 1600);   // don't hear the bird
      await wait(350);
      await singNotes(notes);
      await cue("signal.not_quite");
      mirroring = false;
    },
  });
});

// ---- Self-check: the recogniser's rules, with made-up notes ---------------------------------------
// A made-up singer: four notes at the given semitones, each `length` seconds, `gap` seconds apart.
function sing(tracker, startAt, semitones, { length = 0.45, gap = 0.15 } = {}) {
  let t = startAt;
  for (const semitone of semitones) {
    for (let at = t; at < t + length; at += 0.033) tracker.feed(at, semitone);
    t += length;
    for (let at = t; at < t + gap; at += 0.033) tracker.feed(at, null);
    t += gap;
  }
  return t;
}
function quiet(tracker, from, seconds) {
  for (let at = from; at < from + seconds; at += 0.033) tracker.feed(at, null);
  return from + seconds;
}
const callFrom = (start, offsets = [0, 0, 0]) => {      // the call's shape from `start`, each jump off by `offsets`
  const s = [start];
  CALL_SHAPE.forEach((jump, i) => s.push(s[i] + jump + offsets[i]));
  return s;
};
const fourNotes = (semitones, starts) => semitones.map((semitone, i) => ({ semitone, start: starts[i], end: starts[i] + 0.5 }));

const CHECKS = [
  ["the call, whistled in the original key", () => compareWithTheCall(fourNotes(callFrom(10), [0, 0.6, 1.2, 1.8])).isTheCall],
  ["the call, hummed low and 2 semitones off on each jump", () => compareWithTheCall(fourNotes(callFrom(-22, [2, -2, 2]), [0, 0.8, 1.6, 2.4])).isTheCall],
  ["a different tune is not the call", () => !compareWithTheCall(fourNotes([0, 5, 10, 15], [0, 0.8, 1.6, 2.4])).isTheCall],
  ["too fast (1 s) is not the call", () => !compareWithTheCall(fourNotes(callFrom(0), [0, 0.2, 0.3, 0.5])).isTheCall],
  ["too slow (9 s) is not the call", () => !compareWithTheCall(fourNotes(callFrom(0), [0, 3, 6, 8.5])).isTheCall],
  ["a hummed call is recognised from the sound, moment by moment", () => {
    let heard = 0;
    const tracker = makeNoteTracker({ onHeard: () => heard++ });
    quiet(tracker, sing(tracker, 0, callFrom(-20, [1, 1, -1])), 1);
    return heard === 1;
  }],
  ["a wrong phrase is mirrored once, after a pause", () => {
    const mirrored = [];
    const tracker = makeNoteTracker({ onHeard: () => {}, onMirror: (four) => mirrored.push(four) });
    quiet(tracker, sing(tracker, 0, [0, 5, 10, 15]), 2);
    return mirrored.length === 1 && mirrored[0].length === 4;
  }],
  ["a second wrong phrase within 5 s is not mirrored; a later one is", () => {
    let count = 0;
    const tracker = makeNoteTracker({ onHeard: () => {}, onMirror: () => count++ });
    let t = quiet(tracker, sing(tracker, 0, [0, 5, 10, 15]), 1.5);
    t = quiet(tracker, sing(tracker, t, [0, 4, 8, 12]), 1.5);
    const afterSecond = count;
    t = quiet(tracker, t, 4);
    quiet(tracker, sing(tracker, t, [0, 4, 8, 12]), 1.5);
    return afterSecond === 1 && count === 2;
  }],
  ["a slip of an octave inside a note doesn't split it", () => {
    let mirrored = null;
    const tracker = makeNoteTracker({ onHeard: () => {}, onMirror: (four) => (mirrored = four) });
    let t = 0;
    for (const [i, semitone] of [0, 5, 10, 15].entries()) {
      for (let at = t; at < t + 0.45; at += 0.033) tracker.feed(at, i === 1 && at > t + 0.2 && at < t + 0.27 ? semitone - 12 : semitone);
      t = quiet(tracker, t + 0.45, 0.15);
    }
    quiet(tracker, t, 2);
    return mirrored && mirrored.length === 4 && Math.abs(mirrored[1].semitone - 5) < 0.5;
  }],
  ["while the bird sings (deafened), nothing is heard", () => {
    let heard = 0;
    const tracker = makeNoteTracker({ onHeard: () => heard++ });
    tracker.deafen(10);
    quiet(tracker, sing(tracker, 0, callFrom(0)), 1);
    return heard === 0;
  }],
];

$("self-check").addEventListener("click", () => {
  $("checks").replaceChildren();
  let passed = 0;
  for (const [name, check] of CHECKS) {
    let ok = false;
    try { ok = Boolean(check()); } catch (error) { console.error(error); }
    if (ok) passed++;
    $("checks").append(Object.assign(document.createElement("li"), { textContent: `${ok ? "✓" : "✗"} ${name}`, className: ok ? "pass" : "fail" }));
  }
  $("checks").append(Object.assign(document.createElement("li"), { textContent: `${passed} of ${CHECKS.length} passed`, className: passed === CHECKS.length ? "pass" : "fail" }));
  window.selfCheckResult = { passed, total: CHECKS.length };
});
