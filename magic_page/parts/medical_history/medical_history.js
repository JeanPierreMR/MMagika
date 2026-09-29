// MEDICAL HISTORY — memories of medicine, oldest first.
//
// What starts it:  the healing spell, in two steps:
//   1. floodWithMemories(): pictures rush in ON TOP of everything, one after another,
//      like memories flooding back. Each one appears at once, then slowly fades away,
//      and the next one arrives while the last is still fading. Every picture is shown
//      exactly once, oldest first. Takes about 12 seconds (the healing spell waits for it).
//   2. keepMemoriesInBackground(): once the scroll is open, pictures keep drifting in and
//      out BEHIND everything, smaller and quieter, forever.
// What it uses:    the picture list in medical_history.html (in date order).
// What changes:    only what's on screen.
// If a picture fails to load, it simply shows nothing for its turn.
//
// Nothing here is truly random: the pauses, spots, sizes and tilts come from fixed lists
// and an evenly-scattering number pattern, so it LOOKS random but is the same every time.

// The pauses before each picture arrives, in milliseconds. Uneven on purpose, so it feels
// like memories surfacing on their own. Used in turn, then again from the start.
const FLOOD_PAUSES = [1100, 700, 1500, 900, 1300, 600, 1400, 1000, 800, 1200];
const BACKGROUND_PAUSES = [2900, 2100, 3400, 2500, 3100, 2300, 3700, 2700];
const FLOOD_PICTURE_LIFE = 5500;        // matches "memory-rushes-past" in the CSS
const BACKGROUND_PICTURE_LIFE = 9000;   // matches "memory-comes-and-goes" in the CSS

// Tilts in degrees, used in turn.
const TILTS = [-4.5, 3, -1.5, 6, -6.5, 1, 4.5, -3, 2, -5];


const pictures = [...document.getElementById("medical-pictures").content.children];
const floodLayer = document.getElementById("memory-flood");
const backgroundLayer = document.getElementById("memory-background");

// The background goes through the pictures in a mixed-up order by jumping ahead a few at a
// time (0, 3, 6, 9, 2, 5, ...). The jump shares no divisor with the number of pictures, so every
// picture gets a turn before any comes back: the same picture is never on screen twice.
function jumpThatVisitsEveryPicture() {
  const greatestCommonDivisor = (a, b) => (b === 0 ? a : greatestCommonDivisor(b, a % b));
  let jump = 3;
  while (greatestCommonDivisor(jump, pictures.length) !== 1) jump++;
  return jump;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// A pattern that scatters points evenly over the screen without clumping (the "R2 sequence").
// Turn number n always gives the same spot; neighbouring turns land far apart.
function scatteredSpot(n) {
  return {
    across: (0.37 + n * 0.7548776662) % 1,   // 0 = left edge, 1 = right edge
    down: (0.61 + n * 0.5698402910) % 1,     // 0 = top, 1 = bottom
  };
}

// A size between smallest and largest that changes from turn to turn without a pattern you'd notice.
function scatteredSize(n, smallest, largest) {
  return smallest + ((0.2 + n * 0.6180339887) % 1) * (largest - smallest);
}

// Put a copy of one picture on a layer for a while. "turn" picks its spot, size and tilt.
function showPicture(pictureNumber, turn, layer, kind, smallestSize, largestSize, life) {
  const picture = pictures[pictureNumber % pictures.length].cloneNode(true);
  const spot = scatteredSpot(turn);

  const size = scatteredSize(turn, smallestSize, largestSize);           // in % of the smaller screen side
  const sizeInPixels = (size / 100) * Math.min(window.innerWidth, window.innerHeight);
  picture.classList.add(kind);
  picture.style.width = sizeInPixels + "px";
  // Mostly on screen, sometimes peeking in over an edge.
  picture.style.left = spot.across * (window.innerWidth - sizeInPixels * 0.6) - sizeInPixels * 0.2 + "px";
  picture.style.top = spot.down * (window.innerHeight - sizeInPixels * 0.6) - sizeInPixels * 0.2 + "px";
  picture.style.setProperty("--tilt", TILTS[turn % TILTS.length] + "deg");
  layer.appendChild(picture);
  setTimeout(() => picture.remove(), life);                             // tidy up once it has faded
}

export async function floodWithMemories() {
  // Start downloading every picture now, so none of them appears blank the first time.
  for (const image of document.getElementById("medical-pictures").content.querySelectorAll("img")) {
    new Image().src = image.getAttribute("src");
  }
  // One picture at a time, each once, oldest first. The pauses are shorter than a
  // picture's life, so two or three are always fading on screen together.
  for (let turn = 0; turn < pictures.length; turn++) {
    showPicture(turn, turn, floodLayer, "flood-memory", 26, 44, FLOOD_PICTURE_LIFE);
    await wait(FLOOD_PAUSES[turn % FLOOD_PAUSES.length]);
  }
  await wait(1500);   // let the last one fade a little before the scroll opens
}

export function keepMemoriesInBackground() {
  if (!backgroundLayer.hidden) return;   // already running
  backgroundLayer.hidden = false;

  // The flood used turns 0-9 for its spots, so the background carries on from there
  // and never lands where the last flood picture just was.
  let turn = pictures.length;
  const jump = jumpThatVisitsEveryPicture();
  const addOne = () => {
    const pictureNumber = (turn * jump) % pictures.length;
    showPicture(pictureNumber, turn, backgroundLayer, "background-memory", 16, 26, BACKGROUND_PICTURE_LIFE);
    setTimeout(addOne, BACKGROUND_PAUSES[turn % BACKGROUND_PAUSES.length]);
    turn++;
  };
  addOne();
}
