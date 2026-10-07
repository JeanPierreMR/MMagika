// CHAPTER 3 — THE TERMINAL
//
// What starts it:  the page loading.
// What it does:
//   1. THE CRASH: the kernel panic comes out line by line. Where kernel_panic.txt says [wait 1500]
//      it stops (a blinking cursor), as if the machine were busy; the crash dump itself pours out
//      fast. It stays up long enough to read, the screen tears, one second of black.
//   2. THE TERMINAL types the script (the list in terminal.html) line by line. Each character first
//      appears as an odd symbol and settles into the real letter a moment later; a few never settle.
//      A line with data-working shows a progress bar filling (the machine working on it), and
//      every line waits its data-pause so it can be read.
//      Until the typing ends, the screen glitches every few seconds: its colours split, bars of
//      interference flash across, a handful of letters scramble, or it flickers. (No shaking.)
//      Which characters and which glitches, and when, follow a "looks random" pattern, so it's
//      the same on every visit.
//   3. Everything scrambles, a bright line wipes across, and the clean future interface appears:
//      "Welcome Doctor · Starting letter ***". The words fly up and fade, and the letter opens.
// Sounds:          the panic's hum, static, keystrokes and the welcome chord ("terminal.*" in
//                  shared/sound_orchestra/sound_book.js); all fade out as the words fly up.
// What changes:    the site is told this chapter is finished.

import { makeRandom, pickOneOf } from "../shared/looks_random.js";
import { cue, fadeAll, stopCue } from "../shared/sound_orchestra/orchestra.js";
import { playKeystroke, playStatic } from "../shared/sounds.js";
import { finishChapterAndGoOn } from "../shared/tell_the_site.js";

const ODD_SYMBOLS = [..."▓▒░∆⌁☍⟟⌬⍜⏃⏚⟊⧖⧗⊗⋔⌇⍙⎔◬⟁ʘΞ¥§Ø∑≠"];
const TYPING_SPEED = 26;          // ms per character
const SETTLE_TIME = 70;           // ms a character stays a symbol before it settles
const STAYS_GLITCHED = 0.035;     // share of characters that never settle
const GLITCH_EVERY = [350, 1100];    // ms between glitches while typing (somewhere in this range)
const GLITCH_FLASH = 0.5;            // how long each glitch shows (1 = the original length; smaller = snappier)
const BEEP_EVERY = 1000;             // ms: while the cursor waits between lines, it beeps this often (with its blink)
const BEEP_IF_WAITING = 600;         // ms: only pauses at least this long get beeps
const PANIC_READ_TIME = 3200;     // ms the finished kernel panic stays up before the screen tears
const LINE_PAUSE = 900;           // ms after each line, unless it has its own data-pause
const BAR_CELLS = 14;             // the progress bar's width, in blocks
const TEAR_TIME = 700;            // ms the kernel panic takes to break up; matches screen-tears in terminal.css
const TEAR_BURSTS = 9;            // how many times its text breaks further while it tears
const SWITCH_OFF_TIME = 380;      // ms the old terminal takes to switch off; matches crt-switches-off in terminal.css
const WELCOME_TIME = 3000;        // ms "Welcome Doctor" stays before flying up
const FLY_UP_TIME = 1400;         // ms; matches welcome-flies-up in terminal.css

const motionIsReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const random = makeRandom(2020);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, motionIsReduced ? 0 : ms));
const scene = document.getElementById("terminal-scene");
const terminal = document.querySelector(".terminal");
const cursor = document.querySelector(".cursor");

// ---- 1. The crash ----------------------------------------------------------------------------------
async function crash() {
  cue("terminal.panic");                          // the machine's hum while it panics
  const panic = document.querySelector(".kernel-panic");
  const text = panic.querySelector(".panic-text");
  const lines = document.getElementById("kernel-panic-text").content.textContent.trim().split("\n");
  let shown = 0;
  for (const lineText of lines) {
    const pause = lineText.match(/^\[wait (\d+)\]$/);
    if (pause) {                                    // the machine is busy: a blinking cursor, nothing else
      text.classList.add("is-waiting");
      await wait(Number(pause[1]));
      text.classList.remove("is-waiting");
      continue;
    }
    if (shown === 3) playStatic(0.4);               // the moment it goes wrong
    text.textContent += lineText + "\n";
    // The rest pours out fast, with the odd hitch, like a real console.
    await wait(shown % 9 === 4 ? 160 : 28);
    shown++;
  }
  text.classList.add("is-waiting");
  await wait(PANIC_READ_TIME);
  // The panic breaks up: the screen jumps between ragged slices, colour flips and black frames
  // (terminal.css "screen-tears"), while the text itself turns to garbage, line by line, in bursts.
  panic.classList.add("is-tearing");
  stopCue("terminal.panic", { fade: 0.1 });
  const torn = text.textContent.split("\n");
  for (let burst = 0; burst < TEAR_BURSTS; burst++) {
    for (let i = 0; i < torn.length; i++) {
      if (random() < 0.35) torn[i] = [...torn[i]].map((c) => (c === " " || random() < 0.5 ? c : pickOneOf(ODD_SYMBOLS, random))).join("");
      if (random() < 0.08) torn[i] = "";                                  // a line drops out
    }
    text.textContent = torn.join("\n");
    if (burst % 2 === 0) playStatic(0.06 + random() * 0.08);
    await wait(TEAR_TIME / TEAR_BURSTS);
  }
  const blackout = document.querySelector(".blackout");
  blackout.style.transition = "none";              // cut to black at once, no fade
  blackout.classList.add("is-dark");
  panic.hidden = true;
  await wait(1000);                                 // one second of black
  blackout.classList.remove("is-dark");
  blackout.style.transition = "";
}

// ---- 2. Glitches while it types -----------------------------------------------------------------------
const GLITCHES = {
  coloursSplit() { flash(terminal, "colours-split", 140 * GLITCH_FLASH); },
  flicker() { flash(terminal, "flickers", 90 * GLITCH_FLASH); },
  interference() {
    const bar = document.querySelector(".interference");
    bar.style.setProperty("--bar-top", `${10 + random() * 75}%`);
    bar.style.setProperty("--bar-height", `${1.5 + random() * 6}%`);
    flash(bar, "is-on", 110 * GLITCH_FLASH);
  },
  scramble() {
    const letters = [...terminal.querySelectorAll(".script span span")].filter((l) => l.textContent.trim() && !l.classList.contains("glitched"));
    for (let i = 0; i < 10 && letters.length; i++) {
      const letter = pickOneOf(letters, random);
      const real = letter.textContent;
      letter.textContent = pickOneOf(ODD_SYMBOLS, random);
      setTimeout(() => { letter.textContent = real; }, 160 * GLITCH_FLASH);
    }
  },
};
function flash(element, className, ms) {
  element.classList.add(className);
  setTimeout(() => element.classList.remove(className), ms);
}

let typingIsOver = false;
async function keepGlitching() {
  if (motionIsReduced) return;
  while (!typingIsOver) {
    await wait(GLITCH_EVERY[0] + random() * (GLITCH_EVERY[1] - GLITCH_EVERY[0]));
    if (typingIsOver) return;
    pickOneOf(Object.values(GLITCHES), random)();
    if (random() < 0.4) pickOneOf(Object.values(GLITCHES), random)();   // sometimes two at once
    playStatic(0.08 + random() * 0.1);
  }
}

// ---- 2. The typing -------------------------------------------------------------------------------------
// A line's text, split into pieces that keep their colour (e.g. the red "Red Firewall").
function piecesOf(line) {
  return [...line.childNodes].map((node) => ({
    text: node.textContent,
    className: node.nodeType === Node.ELEMENT_NODE ? node.className : "",
  }));
}

// Waiting between lines: the cursor blinks, and beeps softly with each blink (like the KND terminals),
// starting the blink afresh so the beep and the light go together.
async function waitWithBeeps(ms) {
  if (motionIsReduced || ms < BEEP_IF_WAITING) return wait(ms);
  cursor.style.animation = "none";
  void cursor.offsetWidth;                         // restart the blink from "on"
  cursor.style.animation = "";
  const began = performance.now();
  while (performance.now() - began < ms - 150) {
    cue("terminal.beep");
    await wait(Math.min(BEEP_EVERY, ms - (performance.now() - began)));
  }
}

async function typeLine(line) {
  const pieces = piecesOf(line);
  line.textContent = "";
  line.classList.add("is-typing");
  line.appendChild(cursor);                      // the cursor sits at the end of the line being typed
  const heavyGlitch = pieces.some((piece) => piece.text.includes("#"));   // "#undisclosed" breaks up more
  for (const piece of pieces) {
    const holder = document.createElement("span");
    if (piece.className) holder.className = piece.className;
    line.insertBefore(holder, cursor);
    for (const character of piece.text) {
      const letter = document.createElement("span");
      letter.textContent = character === " " ? " " : pickOneOf(ODD_SYMBOLS, random);
      holder.appendChild(letter);
      if (character !== " " && random() < (heavyGlitch ? STAYS_GLITCHED * 4 : STAYS_GLITCHED)) {
        letter.className = "glitched";
      } else {
        setTimeout(() => { letter.textContent = character; }, motionIsReduced ? 0 : SETTLE_TIME + random() * 60);
      }
      if (character !== " " && random() < 0.5) playKeystroke();
      // Headings are typed faster, like a system banner.
      await wait(line.classList.contains("heading") ? TYPING_SPEED / 2 : TYPING_SPEED);
    }
  }
  if (line.dataset.working) await showWorking(line, Number(line.dataset.working));
  line.classList.replace("is-typing", "is-typed");
  await waitWithBeeps(Number(line.dataset.pause || LINE_PAUSE));
}

// The machine working on a line: a bar fills up to 100% in about `ms`, in uneven jumps with
// stalls (the same ones every visit), like a real progress bar.
async function showWorking(line, ms) {
  const bar = document.createElement("span");
  bar.className = "working";
  line.insertBefore(bar, cursor);
  const ticks = Math.max(1, Math.round(ms / 80));
  const jumps = Array.from({ length: ticks }, () => (random() < 0.3 ? 0 : random() ** 2));   // 0 = a stall
  const total = jumps.reduce((sum, jump) => sum + jump, 0) || 1;
  let share = 0;
  for (const jump of jumps) {
    share += jump / total;
    const filled = Math.round(share * BAR_CELLS);
    bar.textContent = ` [${"▰".repeat(filled)}${"▱".repeat(BAR_CELLS - filled)}] ${Math.round(share * 100)}%`;
    await wait(80);
  }
  bar.textContent = ` [${"▰".repeat(BAR_CELLS)}] 100%`;
  bar.classList.add("is-done");
}

// ---- 3. The end ------------------------------------------------------------------------------------------
// Everything on screen turns to symbols for a moment (the old system letting go).
async function scrambleEverything() {
  playStatic(0.5);
  const letters = terminal.querySelectorAll(".script span span");
  for (let round = 0; round < 6; round++) {
    letters.forEach((letter) => {
      if (letter.textContent.trim()) letter.textContent = pickOneOf(ODD_SYMBOLS, random);
    });
    await wait(70);
  }
}

// The old terminal switches off like an old CRT: not smooth, but in jerky steps — it flares, collapses to
// a bright line, then to a dot, and it's gone (terminal.css "crt-switches-off"), with a crack of static.
async function wipeToTheFuture() {
  playStatic(0.3);
  terminal.classList.add("is-switching-off");
  await wait(SWITCH_OFF_TIME);
  terminal.hidden = true;
  scene.classList.add("is-clean");
  document.querySelector(".welcome").hidden = false;
  cue("terminal.welcome");                        // a soft glassy chord
}

async function run() {
  await crash();
  terminal.hidden = false;
  keepGlitching();
  for (const line of document.querySelectorAll("#script li")) await typeLine(line);
  typingIsOver = true;
  await wait(1200);
  await scrambleEverything();
  await wipeToTheFuture();
  await wait(WELCOME_TIME);
  document.querySelector(".welcome").classList.add("is-leaving");
  fadeAll(FLY_UP_TIME / 1000);
  await wait(FLY_UP_TIME);
  await finishChapterAndGoOn("terminal");
}

run();
