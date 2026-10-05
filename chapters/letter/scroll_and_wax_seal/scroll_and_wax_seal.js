// THE SCROLL AND WAX SEAL
//
// What starts it:  the page loading bends the wax seal around the roll.
//                  The letter chapter calls openScrollAndShowLetter().
// What it does when opened (timings match scroll_and_wax_seal.css):
//   1. the seal glows as the spell gathers in it                 (0.85 s)
//   2. it bursts into flying pieces of wax and embers            (0.55 s before the unrolling starts)
//   3. the ribbons slide away and the sheet unrolls out of the roll (3.4 s)
//   4. only then, with the sheet fully open, the letter (letter.html) writes itself
//      in glowing gold (letter_video_player.js)
// What changes:    only what's on screen.
// The design and the burst come from magical-scroll.html.

import { prepareLetter, writeLetterInGold } from "./letter_video_player.js";

const GLOW_TIME = 850;           // "seal-charges" in the CSS
const BURST_HEAD_START = 550;    // the burst gets going before the sheet starts moving
const UNROLL_TIME = 3400;        // --unroll-time in the CSS

const scroll = document.getElementById("scroll");
const scrollLayer = document.getElementById("scroll-layer");
const readingArea = scroll.querySelector(".reading-area");
const seal = scroll.querySelector(".wax-seal");
const motionIsReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const SVG = "http://www.w3.org/2000/svg";

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, motionIsReduced ? 0 : milliseconds));
}

// ---- Bending the seal around the roll ---------------------------------------------------
// The roll is round, so wax pressed onto it curves away from you at the top and bottom.
// To show that, the seal drawing is cut into 64 thin horizontal strips; strips near the
// top and bottom are squeezed together, strips in the middle are stretched a little.
const STRIPS = 64;
const SEAL_HEIGHT = 126;         // the drawing's height (its viewBox)

function bendSealAroundTheRoll() {
  const whereItLands = (y) => {
    const angle = (y / SEAL_HEIGHT - 0.5) * 2.4;                 // how far round the roll this line is
    return SEAL_HEIGHT / 2 + 50 * Math.sin(angle) / Math.sin(1.2);
  };
  const strips = [];
  for (let i = 0; i < STRIPS; i++) {
    const top = (i * SEAL_HEIGHT) / STRIPS;
    const bottom = ((i + 1) * SEAL_HEIGHT) / STRIPS;
    const strip = document.createElementNS(SVG, "svg");
    strip.setAttribute("viewBox", `0 ${top} 120 ${SEAL_HEIGHT / STRIPS}`);
    strip.setAttribute("preserveAspectRatio", "none");
    strip.setAttribute("x", 0);
    strip.setAttribute("width", 120);
    strip.setAttribute("y", whereItLands(top));
    strip.setAttribute("height", whereItLands(bottom) - whereItLands(top) + 0.12);   // a hair of overlap: no gaps
    const copy = document.createElementNS(SVG, "use");
    copy.setAttribute("href", "#seal-art");
    strip.appendChild(copy);
    strips.push(strip);
  }
  document.getElementById("seal-bent-strips").replaceChildren(...strips);
}

// A picture of the finished seal, for the flying pieces: moving one picture is much
// lighter for the browser than redrawing 64 strips with their shadows in every piece.
function takePictureOfSeal() {
  const picture = new Image();
  picture.alt = "";
  picture.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(seal.querySelector("svg")));
  return picture;
}

// ---- The burst ----------------------------------------------------------------------------
// Not random: every piece has its own fixed direction, distance and spin, chosen by hand,
// so the burst looks lively but is the same each time.
const BURST = {
  duration: 1000,
  trailTimes: [30, 100, 190, 310, 460],                          // when each piece drops an ember
  angles: [0, 24, 57, 90, 117, 151, 184, 211, 247, 275, 304, 335, 360],   // where the seal is cut into 12 pieces
  distances: [238, 276, 215, 252, 229, 284, 247, 221, 270, 233, 258, 242],
  spins: [184, -228, 145, -196, 254, -167, 210, -240, 176, -214, 232, -158],
  tumbles: [-64, 86, -102, 72, -88, 110, -76, 94, -58, 82, -96, 68],
  emberDrift: [[-11, -48], [9, -65], [-5, -37], [14, -56], [-14, -70], [6, -43]],
  sparks: [[8, 95], [23, 138], [41, 112], [56, 158], [74, 86], [89, 126], [103, 147],
    [119, 101], [134, 162], [149, 119], [163, 92], [178, 144], [192, 108], [208, 156],
    [224, 98], [238, 131], [253, 168], [268, 114], [281, 87], [296, 150], [310, 105],
    [324, 136], [338, 93], [351, 159]],                          // [direction in degrees, distance]
};

function burstTheSeal(sealPicture) {
  if (motionIsReduced) return;
  const layerBox = scrollLayer.getBoundingClientRect();
  const sealBox = seal.getBoundingClientRect();
  const halfWidth = seal.offsetWidth / 2;
  const halfHeight = seal.offsetHeight / 2;

  // Everything flies out of a box the size of the seal, placed where the seal is.
  const burst = document.createElement("div");
  burst.className = "seal-burst";
  burst.style.width = seal.offsetWidth + "px";
  burst.style.height = seal.offsetHeight + "px";
  burst.style.left = sealBox.left + sealBox.width / 2 - layerBox.left - halfWidth + "px";
  burst.style.top = sealBox.top + sealBox.height / 2 - layerBox.top - halfHeight + "px";
  scrollLayer.appendChild(burst);

  const allFinished = [];
  const play = (thing, frames, options) => {
    const animation = thing.animate(frames, { fill: "both", ...options });
    allFinished.push(animation.finished.then(() => thing.remove(), () => thing.remove()));
  };

  // A faint flash over the whole screen, and a glow spreading out of the seal.
  const flash = document.createElement("div");
  flash.className = "explosion-flash";
  document.body.appendChild(flash);
  play(flash, [{ opacity: 0 }, { opacity: 0.1, offset: 0.1 }, { opacity: 0.035, offset: 0.35 }, { opacity: 0 }], { duration: 420, easing: "ease-out" });
  const aura = document.createElement("div");
  aura.className = "burst-aura";
  burst.appendChild(aura);

  // A tiny glowing ember that floats away and fades.
  const addEmber = (x, y, number, delay = 0, outwardX = 0, outwardY = 0) => {
    const ember = document.createElement("i");
    ember.className = "ember";
    ember.style.left = x + "px";
    ember.style.top = y + "px";
    burst.appendChild(ember);
    const [driftX, driftY] = BURST.emberDrift[number % BURST.emberDrift.length];
    play(ember, [
      { opacity: 0, transform: "translate(0,0) scale(1.3)" },
      { opacity: 1, offset: 0.08 },
      { opacity: 0.65, offset: 0.4 },
      { opacity: 0, transform: `translate(${outwardX + driftX}px,${outwardY + driftY}px) scale(0)` },
    ], { duration: 2400, delay, easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)" });
  };

  // The pieces: each is the whole seal picture, cut to a pie slice, flying outwards.
  const inRadians = (degrees) => (degrees * Math.PI) / 180;
  for (let i = 0; i < BURST.angles.length - 1; i++) {
    const from = inRadians(BURST.angles[i]);
    const to = inRadians(BURST.angles[i + 1]);
    const direction = (from + to) / 2;
    const piece = document.createElement("div");
    piece.className = "wax-shard";
    piece.style.clipPath = `polygon(48% 49%, ${48 + Math.cos(from) * 110}% ${49 + Math.sin(from) * 110}%, ${48 + Math.cos(to) * 110}% ${49 + Math.sin(to) * 110}%)`;
    piece.appendChild(sealPicture.cloneNode());
    burst.appendChild(piece);

    const dx = Math.cos(direction) * BURST.distances[i];
    const dy = Math.sin(direction) * BURST.distances[i] * 0.75;
    const whereAt = (t) => {                                     // t goes from 0 (start) to 1 (end)
      const spread = 1 - Math.pow(1 - t, 2);                     // fast at first, then slowing down
      return { x: dx * spread, y: dy * spread + 18 * t * t };    // and falling a little
    };
    const frames = [];
    for (let n = 0; n <= 40; n++) {
      const t = n / 40;
      const at = whereAt(t);
      const fade = Math.max(0, Math.min(1, (t - 0.16) / 0.72));
      frames.push({
        offset: t,
        transform: `translate(${at.x}px,${at.y}px) rotate(${BURST.spins[i] * t}deg) rotateY(${BURST.tumbles[i] * t}deg) scale(${1 - 0.5 * t})`,
        opacity: 1 - fade * fade * (3 - 2 * fade),
      });
    }
    play(piece, frames, { duration: BURST.duration, easing: "linear" });
    BURST.trailTimes.forEach((delay, j) => {
      const at = whereAt(delay / BURST.duration);
      addEmber(halfWidth + Math.cos(direction) * 19 + at.x, halfHeight + Math.sin(direction) * 19 + at.y, i + j, delay);
    });
  }
  BURST.sparks.forEach(([degrees, distance], i) => {
    addEmber(halfWidth, halfHeight, i, 0, Math.cos(inRadians(degrees)) * distance, Math.sin(inRadians(degrees)) * distance);
  });
  Promise.all(allFinished).then(() => burst.remove());          // tidy up after the last ember fades
}

// ---- Opening the scroll ----------------------------------------------------------------
export async function openScrollAndShowLetter() {
  if (scroll.classList.contains("is-open")) return;
  prepareLetter(readingArea);              // normally done long ago (see the bottom of this file)
  const sealPicture = takePictureOfSeal();

  scroll.classList.add("is-breaking");     // 1. the seal glows
  await wait(GLOW_TIME);
  burstTheSeal(sealPicture);               // 2. and bursts
  scroll.classList.add("is-shattered");
  await wait(BURST_HEAD_START);
  scroll.classList.add("is-open");         // 3. the ribbons go and the sheet unrolls (see the CSS)
  scroll.classList.remove("is-closed");
  await wait(UNROLL_TIME);                 // 4. wait until it's fully open...
  await writeLetterInGold(readingArea);    //    ...then the letter writes itself
  readingArea.focus({ preventScroll: true });   // so the keyboard's arrow keys scroll the letter
}

bendSealAroundTheRoll();

// Build the letter at its final size while the scroll is still rolled up (it's invisible), once
// the page has settled. Then, when the writing starts, every paragraph already has its room.
setTimeout(() => prepareLetter(readingArea), 1500);
