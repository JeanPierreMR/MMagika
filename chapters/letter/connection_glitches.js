// CONNECTION GLITCHES — every now and then the connection to the Dreamers seems to fail for a
// moment, over the letter page.
//
// What starts it:  letter.js, once the frame has drawn itself in.
// What it does:    every GLITCH_EVERY (a "looks random" pause, the same on every visit), one or
//                  two of these happen, for a fraction of a second:
//                    halfDark  — the top, bottom, left or right half goes dark, crossed by green lines
//                    grain     — the whole picture breaks into moving grain, tinted green
//                    sweep     — a few bright green lines race across
//                  and the "CHANNEL SECURE" readout flickers to "SIGNAL DEGRADED".
// What changes:    only what's on screen. Nothing runs between glitches (the layers are hidden).
// How often, how long, which halves: the numbers just below.

import { makeRandom, pickOneOf } from "../shared/looks_random.js";

const GLITCH_EVERY = [5000, 13000];     // ms between glitches (somewhere in this range)
const HALF_DARK_FOR = [180, 520];       // ms
const GRAIN_FOR = [600, 1500];          // ms
const SWEEP_FOR = 350;                  // ms; matches lines-sweep in connection_glitches.css
const HALVES = ["top", "bottom", "left", "right"];

const random = makeRandom(404);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const between = ([low, high]) => low + random() * (high - low);

// The grain: a small square of random grey dots, made once and tiled over the screen.
function makeGrainPicture() {
  const size = 160;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const pen = canvas.getContext("2d");
  const pixels = pen.createImageData(size, size);
  const dots = makeRandom(7);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const grey = Math.floor(dots() * 255);
    pixels.data.set([grey * 0.6, grey, grey * 0.7, 90 + dots() * 110], i);   // greenish grey
  }
  pen.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}

export function startConnectionGlitches() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const halfDark = document.querySelector(".glitch-half-dark");
  const grain = document.querySelector(".glitch-grain");
  const sweep = document.querySelector(".glitch-sweep");
  const status = document.querySelector(".readout.top-left .status-word");
  grain.style.backgroundImage = `url("${makeGrainPicture()}")`;

  async function show(element, ms) {
    element.hidden = false;
    await wait(ms);
    element.hidden = true;
  }

  const GLITCHES = {
    halfDark: () => {
      halfDark.dataset.half = pickOneOf(HALVES, random);
      return show(halfDark, between(HALF_DARK_FOR));
    },
    grain: () => show(grain, between(GRAIN_FOR)),
    sweep: () => show(sweep, SWEEP_FOR),
  };

  async function now() {
    status.textContent = "SIGNAL DEGRADED";
    const first = pickOneOf(Object.keys(GLITCHES), random);
    const happening = [GLITCHES[first]()];
    if (random() < 0.45) happening.push(GLITCHES[pickOneOf(Object.keys(GLITCHES).filter((g) => g !== first), random)]());
    await Promise.all(happening);
    if (random() < 0.3) {                          // sometimes it stutters straight back
      await wait(90);
      await GLITCHES.halfDark();
    }
    status.textContent = "CHANNEL SECURE";
  }

  (async function keepGoing() {
    for (;;) {
      await wait(between(GLITCH_EVERY));
      await now();
    }
  })();
}
