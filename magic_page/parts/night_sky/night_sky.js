// THE NIGHT SKY
//
// What starts it:  the page loading.
// What it does:    draws hundreds of stars that slowly pulse brighter and dimmer.
//                  Most are yellow-white; about one in twelve has a colour.
// What changes:    after the healing spell, turnStarsIntoColouredCrosses() makes
//                  every star turn, one by one, into a small coloured cross.
//                  The crosses are never red or pink, so none of them reads as a red cross.

const sky = document.getElementById("night-sky");
const pen = sky.getContext("2d");   // the "pen" we draw on the canvas with

const STAR_WHITE = "#fff6d6";
const OCCASIONAL_STAR_COLOURS = ["#b44cff", "#c9a7ff", "#7dff6a", "#8fd3ff", "#e8c15a"];
const CROSS_COLOURS = ["#b44cff", "#c9a7ff", "#7b2cbf", "#7dff6a", "#4fd1c5", "#8fd3ff", "#e8c15a"];

const motionIsReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let stars = [];
let starsHaveBecomeCrosses = false;

function pickOneOf(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Fill the sky with stars. Called at the start and whenever the window changes size.
function scatterStars() {
  // Canvases look blurry on sharp screens unless we draw at the screen's real pixel density.
  const pixelDensity = window.devicePixelRatio || 1;
  sky.width = window.innerWidth * pixelDensity;
  sky.height = window.innerHeight * pixelDensity;
  pen.setTransform(pixelDensity, 0, 0, pixelDensity, 0, 0);

  const howMany = Math.min(220, Math.round((window.innerWidth * window.innerHeight) / 8000));   // a sparse sky
  stars = [];
  for (let i = 0; i < howMany; i++) {
    const isColoured = Math.random() < 1 / 12;
    stars.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: 0.6 + Math.random() * 1.6,
      colour: isColoured ? pickOneOf(OCCASIONAL_STAR_COLOURS) : STAR_WHITE,
      crossColour: pickOneOf(CROSS_COLOURS),
      pulseSpeed: 0.0008 + Math.random() * 0.0025,   // how fast it pulses
      pulseStart: Math.random() * Math.PI * 2,       // so they don't all pulse together
      becomesCrossAt: starsHaveBecomeCrosses ? 0 : Infinity,   // set by turnStarsIntoColouredCrosses()
    });
  }
}

// Each star is a bright dot inside a bigger, faint dot: the faint one looks like a glow.
// (Cheaper than the canvas "blur" effect, which is slow in some browsers with many stars.)
function drawStarDot(star, brightness) {
  pen.fillStyle = star.colour;
  pen.globalAlpha = brightness * 0.18;
  pen.beginPath();
  pen.arc(star.x, star.y, star.size * 3.2, 0, Math.PI * 2);
  pen.fill();
  pen.globalAlpha = brightness;
  pen.beginPath();
  pen.arc(star.x, star.y, star.size, 0, Math.PI * 2);
  pen.fill();
}

function drawStarCross(star, brightness) {
  const arm = star.size * 2.6;                       // half the length of each bar of the cross
  const thickness = Math.max(1.2, star.size * 0.9);
  pen.fillStyle = star.crossColour;
  pen.globalAlpha = brightness * 0.15;               // faint glow behind the cross
  pen.beginPath();
  pen.arc(star.x, star.y, arm * 1.6, 0, Math.PI * 2);
  pen.fill();
  pen.globalAlpha = brightness;
  pen.fillRect(star.x - thickness / 2, star.y - arm, thickness, arm * 2);   // upright bar
  pen.fillRect(star.x - arm, star.y - thickness / 2, arm * 2, thickness);   // sideways bar
}

function drawSky(timeInMs) {
  pen.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (const star of stars) {
    // Brightness swings smoothly between 30% and 100%.
    const pulse = motionIsReduced ? 1 : 0.5 + 0.5 * Math.sin(timeInMs * star.pulseSpeed + star.pulseStart);
    const brightness = 0.3 + 0.7 * pulse;
    if (timeInMs >= star.becomesCrossAt) {
      drawStarCross(star, brightness);
    } else {
      drawStarDot(star, brightness);
    }
  }
  pen.globalAlpha = 1;
  requestAnimationFrame(drawSky);                    // draw again on the next screen refresh
}

// Called by the healing spell. Over about two seconds, each star becomes a cross.
export function turnStarsIntoColouredCrosses() {
  starsHaveBecomeCrosses = true;
  const now = performance.now();
  for (const star of stars) {
    star.becomesCrossAt = now + Math.random() * 2000;
  }
}

scatterStars();
window.addEventListener("resize", scatterStars);
requestAnimationFrame(drawSky);
