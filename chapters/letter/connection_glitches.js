// CONNECTION GLITCHES — every now and then the connection to the Dreamers seems to fail for a
// moment, over the letter page. Small and quick: nothing ever covers the letter.
//
// What starts it:  letter.js, once the scroll opens.
// What it does:    every GLITCH_EVERY (a "looks random" pause, the same on every visit), one or
//                  two of these happen, for a fraction of a second:
//                    lines  — a few thin vertical green lines flicker, here and there
//                    sweep  — a few bright vertical green lines race across the screen
//                    speck  — a small strip of green grain flickers somewhere
//                  and the "CHANNEL SECURE" readout flickers to "SIGNAL DEGRADED".
// What changes:    only what's on screen. Nothing runs between glitches (the layers are hidden).
// How often, how long, how many: the numbers just below.

import { makeRandom, pickOneOf } from "../shared/looks_random.js";
import { cue, duck } from "../shared/sound_orchestra/orchestra.js";

const GLITCH_EVERY = [16000, 36000];    // ms between glitches (somewhere in this range): rare, but each one fast
const LINES_FOR = [60, 160];            // ms the flickering lines stay
const HOW_MANY_LINES = [2, 5];          // how many lines flicker at once
const SPECK_FOR = [80, 200];            // ms the strip of grain stays
const SPECK_SIZE = { width: [90, 240], height: [5, 16] };   // px
const SWEEP_FOR = 180;                  // ms; matches lines-sweep in connection_glitches.css

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
  const lines = document.querySelector(".glitch-lines");
  const speck = document.querySelector(".glitch-speck");
  const sweep = document.querySelector(".glitch-sweep");
  const status = document.querySelector(".readout.top-left .status-word");
  speck.style.backgroundImage = `url("${makeGrainPicture()}")`;

  async function show(element, ms) {
    element.hidden = false;
    await wait(ms);
    element.hidden = true;
  }

  const GLITCHES = {
    lines: () => {
      const count = Math.round(between(HOW_MANY_LINES));
      lines.replaceChildren(...Array.from({ length: count }, () => {
        const line = document.createElement("i");
        line.style.left = `${random() * 100}%`;
        line.style.width = `${1 + Math.floor(random() * 3)}px`;
        line.style.opacity = 0.35 + random() * 0.6;
        return line;
      }));
      return show(lines, between(LINES_FOR));
    },
    speck: () => {
      const width = between(SPECK_SIZE.width);
      speck.style.width = `${width}px`;
      speck.style.height = `${between(SPECK_SIZE.height)}px`;
      speck.style.left = `calc(${random() * 100}% - ${width * random()}px)`;
      speck.style.top = `${5 + random() * 90}%`;
      return show(speck, between(SPECK_FOR));
    },
    sweep: () => show(sweep, SWEEP_FOR),
  };

  async function now() {
    status.textContent = "SIGNAL DEGRADED";
    duck("letter.choir", 0.35, 0.8);              // the choir dips with the signal
    cue("letter.glitch");
    const first = pickOneOf(Object.keys(GLITCHES), random);
    const happening = [GLITCHES[first]()];
    if (random() < 0.45) happening.push(GLITCHES[pickOneOf(Object.keys(GLITCHES).filter((g) => g !== first), random)]());
    await Promise.all(happening);
    if (random() < 0.3) {                          // sometimes it stutters straight back
      await wait(90);
      await GLITCHES.lines();
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
