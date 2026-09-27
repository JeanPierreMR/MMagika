// THE SCROLL AND WAX SEAL
//
// What starts it:  the page loading draws the wax seal's melted edge.
//                  The healing spell calls openScrollWithMessage("Live with all your heart").
// What it does when opened:
//   1. a crack runs across the seal
//   2. the seal falls away and the scroll unrolls
//   3. the message appears letter by letter, each letter glowing and changing colour
//   4. small hearts keep glittering out of the word "heart" (using the borrowed
//      canvas-confetti library)
// What changes:    only what's on screen.

const scroll = document.getElementById("scroll");
const messageSpot = document.getElementById("scroll-message");
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
export async function openScrollWithMessage(message) {
  if (scroll.classList.contains("is-open")) return;
  hint.classList.add("is-gone");

  scroll.classList.add("is-breaking");     // the crack runs across the seal
  await wait(600);
  scroll.classList.add("is-open");         // the seal falls, the paper unrolls (see the CSS)
  scroll.classList.remove("is-closed");
  await wait(900);

  writeGlowingLetters(message);
  await wait(message.length * 90 + 600);    // until the last letter has appeared
  startHeartGlitter();
}

// Put each letter in its own little box so each one can glow and change colour on its own.
// The word "heart" is also wrapped as a whole, so we know where the hearts should come from.
function writeGlowingLetters(message) {
  messageSpot.textContent = "";
  messageSpot.setAttribute("aria-label", message);   // screen readers read the whole sentence at once
  let letterNumber = 0;

  for (const word of message.split(" ")) {
    const wordBox = document.createElement("span");
    if (word.toLowerCase() === "heart") wordBox.id = "word-heart";
    for (const letter of word) {
      wordBox.appendChild(makeGlowingLetter(letter, letterNumber++));
    }
    messageSpot.appendChild(wordBox);
    messageSpot.appendChild(makeGlowingLetter(" ", letterNumber++));
  }
}

function makeGlowingLetter(letter, letterNumber) {
  const box = document.createElement("span");
  box.className = letter === " " ? "glowing-letter space" : "glowing-letter";
  box.textContent = letter;
  box.setAttribute("aria-hidden", "true");
  // Letter 0 appears first, then each one 90 ms later; the colour ripple is offset the same way.
  box.style.animationDelay = `${letterNumber * 0.09}s, ${letterNumber * -0.25}s`;
  return box;
}

// ---- Hearts glittering out of the word "heart" ----------------------------------------
// canvas-confetti (borrowed) throws little shapes that fly and fall. We give it our own
// canvas, and ask it not to use a separate background helper ("worker"), which this
// site's security rules would block.
function startHeartGlitter() {
  const word = document.getElementById("word-heart");
  if (!word) return;
  const throwConfetti = confetti.create(document.getElementById("heart-glitter"), { resize: true, useWorker: false });

  let heartShape;
  try {
    // An SVG path drawing of a heart.
    heartShape = confetti.shapeFromPath({ path: "M167 72c19,-38 37,-56 75,-56 42,0 76,33 76,75 0,76 -76,151 -151,227 -76,-76 -151,-151 -151,-227 0,-42 33,-75 75,-75 38,0 57,18 76,56z" });
  } catch {
    heartShape = "circle";   // very old browsers can't make shapes from paths; round glitter instead
  }

  setInterval(() => {
    const box = word.getBoundingClientRect();
    throwConfetti({
      particleCount: 3,
      angle: 90,                     // straight up...
      spread: 70,                    // ...fanning out a little to each side
      startVelocity: 22,
      gravity: 0.45,
      drift: (Math.random() - 0.5) * 0.8,
      ticks: 160,                    // how long each heart lives
      scalar: 0.85,                  // size
      shapes: [heartShape],
      colors: ["#ff6fae", "#ff9bd2", "#c9a7ff", "#b44cff", "#e8c15a"],
      origin: {                      // the top of the word, as a fraction of the screen
        x: (box.left + Math.random() * box.width) / window.innerWidth,
        y: box.top / window.innerHeight,
      },
      disableForReducedMotion: true,
    });
  }, 350);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

drawMeltedWaxEdge();
