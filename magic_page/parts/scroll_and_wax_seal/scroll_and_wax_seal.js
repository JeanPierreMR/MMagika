// THE SCROLL AND WAX SEAL
//
// What starts it:  the page loading draws the wax seal's melted edge.
//                  The healing spell calls openScrollAndShowLetter().
// What it does when opened:
//   1. a crack runs across the seal
//   2. the seal falls away and the black scroll unrolls
//   3. once fully unrolled, the letter (letter.html) writes itself in glowing gold (letter_in_gold.js)
// What changes:    only what's on screen.

import { writeLetterInGold } from "./letter_in_gold.js";

const scroll = document.getElementById("scroll");
const paper = scroll.querySelector(".paper");
const hint = document.getElementById("scroll-hint");

// ---- The melted edge of the wax -------------------------------------------------
// Real sealing wax spreads unevenly. To draw that, we walk around a circle in
// small steps and push the edge a little outwards or inwards at each step, using
// two gentle waves plus a few bigger drips. The result is a lumpy, melted circle.
function drawMeltedWaxEdge() {
  const centre = 60;
  const usualRadius = 50;
  const drips = [0.7, 2.4, 4.1, 5.5];    // angles (in radians) where the wax ran further
  const corners = [];

  for (let step = 0; step < 90; step++) {
    const angle = (step / 90) * Math.PI * 2;
    let radius = usualRadius
      + 2.6 * Math.sin(angle * 5 + 0.4)       // a slow wave: 5 bumps around the edge
      + 1.4 * Math.sin(angle * 13 + 1.7);     // a quicker, smaller wave
    for (const dripAngle of drips) {
      const closeness = Math.max(0, 1 - Math.abs(angle - dripAngle) / 0.28);
      radius += 5 * closeness * closeness;    // a rounded bulge where a drip is
    }
    corners.push(`${(centre + radius * Math.cos(angle)).toFixed(1)} ${(centre + radius * Math.sin(angle)).toFixed(1)}`);
  }
  document.getElementById("melted-wax-edge").setAttribute("d", "M" + corners.join(" L") + " Z");
}

// ---- Opening the scroll ------------------------------------------------------------
export async function openScrollAndShowLetter() {
  if (scroll.classList.contains("is-open")) return;
  hint.classList.add("is-gone");

  scroll.classList.add("is-breaking");     // the crack runs across the seal
  await wait(600);
  scroll.classList.add("is-open");         // the seal falls, the paper unrolls (see the CSS)
  scroll.classList.remove("is-closed");
  await wait(1800);                        // let it finish unrolling (1.8 s in the CSS), so the letter is laid out at full width
  await writeLetterInGold(paper);
  paper.focus({ preventScroll: true });    // so the keyboard's arrow keys scroll the letter
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

drawMeltedWaxEdge();
