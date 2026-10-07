// THE NIGHT SKY
//
// What starts it:  the letter chapter's page loading.
// What it does:    draws a sparse sky of stars that slowly pulse brighter and dimmer.
//                  Most are yellow-white; about one in twelve has a colour.
//                  The pulse is slow, so the sky is redrawn 20 times a second (it looks the same
//                  as 60, at a third of the work).
// What changes:    only what's on screen.

import { makeRandom, pickOneOf } from "../../shared/looks_random.js";

const STAR_WHITE = "#fff6d6";
const OCCASIONAL_STAR_COLOURS = ["#6ff3ff", "#c9a7ff", "#8dffb5", "#e6c87e"];
const REDRAWS_PER_SECOND = 20;
const MAX_PIXEL_DENSITY = 2;        // sharp on every screen; see scatterStars

const sky = document.getElementById("night-sky");
const pen = sky.getContext("2d");   // the "pen" we draw on the canvas with
const motionIsReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let stars = [];

// Fill the sky with stars. Called at the start and whenever the window changes size.
function scatterStars() {
  // Canvases look blurry on sharp screens unless we draw at the screen's pixel density. Up to
  // MAX_PIXEL_DENSITY: beyond that (some phones are 3× or more) soft round stars look no sharper,
  // but the canvas has more than twice as many pixels to clear and fill on every redraw.
  const pixelDensity = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_DENSITY);
  sky.width = window.innerWidth * pixelDensity;
  sky.height = window.innerHeight * pixelDensity;
  pen.setTransform(pixelDensity, 0, 0, pixelDensity, 0, 0);

  const random = makeRandom(2026);
  const howMany = Math.min(220, Math.round((window.innerWidth * window.innerHeight) / 8000));   // a sparse sky
  stars = [];
  for (let i = 0; i < howMany; i++) {
    stars.push({
      x: random() * window.innerWidth,
      y: random() * window.innerHeight,
      size: 0.6 + random() * 1.6,
      colour: random() < 1 / 12 ? pickOneOf(OCCASIONAL_STAR_COLOURS, random) : STAR_WHITE,
      pulseSpeed: 0.0008 + random() * 0.0025,   // how fast it pulses
      pulseStart: random() * Math.PI * 2,       // so they don't all pulse together
    });
  }
}

// Each star is a bright dot inside a bigger, faint dot: the faint one looks like a glow.
function drawStar(star, brightness) {
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

let lastDrawn = -Infinity;
function drawSky(timeInMs) {
  requestAnimationFrame(drawSky);
  if (timeInMs - lastDrawn < 1000 / REDRAWS_PER_SECOND) return;
  lastDrawn = timeInMs;
  pen.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (const star of stars) {
    // Brightness swings smoothly between 30% and 100%.
    const pulse = motionIsReduced ? 1 : 0.5 + 0.5 * Math.sin(timeInMs * star.pulseSpeed + star.pulseStart);
    drawStar(star, 0.3 + 0.7 * pulse);
  }
  pen.globalAlpha = 1;
}

scatterStars();
window.addEventListener("resize", scatterStars);
requestAnimationFrame(drawSky);
