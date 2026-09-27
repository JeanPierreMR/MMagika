// THE WAND
//
// What starts it:  moving the mouse (sparkles) and HOLDING the mouse button (red line).
// What it does:
//   - Sparkles trail behind the mouse (made by the borrowed cursor-effects library).
//   - While the button is held, a glowing red line follows the mouse.
//   - When the button is released, the line stays for 1 more second. Pressing again
//     within that second adds another line to the same drawing, which is how you
//     draw a cross (two lines).
//   - After that second, the whole drawing is handed to the spellbook, which decides
//     whether it was a spell. The drawing then fades: gold if it was a spell, red if not.
// What changes:    only what's on screen.

import { whenDrawingFinished } from "../spellbook/spellbook.js";

const EXTRA_TIME_AFTER_RELEASE = 1000;   // milliseconds the line stays after letting go
const FADE_TIME = 700;
const RED = "#ff1f3d";
const GOLD = "#e8c15a";

// ---- Sparkles (borrowed: cursor-effects by Tim Holman) ----------------------
// Yellow-white and purples. The library adds its own canvas at the end of the page;
// we give it a class so our CSS can place it in front of everything else.
new cursoreffects.fairyDustCursor({ colors: ["#fff6d6", "#e8c15a", "#c9a7ff", "#b44cff", "#7b2cbf"] });
const sparklesCanvas = document.body.lastElementChild;
if (sparklesCanvas && sparklesCanvas.tagName === "CANVAS") {
  sparklesCanvas.classList.add("wand-sparkles");
}

// ---- The red line ------------------------------------------------------------
const canvas = document.getElementById("red-line");
const pen = canvas.getContext("2d");

let strokes = [];            // the drawing: a list of lines, each line a list of {x, y} points
let buttonIsHeld = false;
let finishTimer = null;      // counts down the extra second after release
let lineColour = RED;
let lineOpacity = 1;

function fitCanvasToWindow() {
  const pixelDensity = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * pixelDensity;
  canvas.height = window.innerHeight * pixelDensity;
  pen.setTransform(pixelDensity, 0, 0, pixelDensity, 0, 0);
  drawTheLines();
}

function drawTheLines() {
  pen.clearRect(0, 0, window.innerWidth, window.innerHeight);
  pen.globalAlpha = lineOpacity;
  pen.lineCap = "round";
  pen.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.length < 2) continue;
    // Draw each line twice: wide and faint (the glow), then thin and bright (the core).
    for (const [width, alpha] of [[14, 0.25], [4, 1]]) {
      pen.strokeStyle = lineColour;
      pen.lineWidth = width;
      pen.globalAlpha = lineOpacity * alpha;
      pen.beginPath();
      pen.moveTo(stroke[0].x, stroke[0].y);
      for (const point of stroke.slice(1)) pen.lineTo(point.x, point.y);
      pen.stroke();
    }
  }
  pen.globalAlpha = 1;
}

function startLine(event) {
  if (event.button !== 0) return;                  // only the main (left) button draws
  clearTimeout(finishTimer);                       // pressed again in time: keep adding to this drawing
  if (lineOpacity < 1) {                           // an old drawing is still fading: start fresh
    strokes = [];
    lineOpacity = 1;
  }
  lineColour = RED;
  buttonIsHeld = true;
  strokes.push([{ x: event.clientX, y: event.clientY }]);
  drawTheLines();
}

function continueLine(event) {
  if (!buttonIsHeld) return;
  strokes[strokes.length - 1].push({ x: event.clientX, y: event.clientY });
  drawTheLines();
}

function endLine() {
  if (!buttonIsHeld) return;
  buttonIsHeld = false;
  finishTimer = setTimeout(finishDrawing, EXTRA_TIME_AFTER_RELEASE);
}

// The extra second is over: ask the spellbook, then fade the drawing away.
function finishDrawing() {
  const drawing = strokes;
  const wasASpell = whenDrawingFinished(drawing);
  lineColour = wasASpell ? GOLD : RED;
  fadeAway(drawing);
}

function fadeAway(drawing) {
  const fadeStartedAt = performance.now();
  function step(now) {
    if (strokes !== drawing) return;               // a new drawing has started; stop fading the old one
    lineOpacity = Math.max(0, 1 - (now - fadeStartedAt) / FADE_TIME);
    drawTheLines();
    if (lineOpacity > 0) {
      requestAnimationFrame(step);
    } else {
      strokes = [];
      lineOpacity = 1;
    }
  }
  requestAnimationFrame(step);
}

window.addEventListener("pointerdown", startLine);
window.addEventListener("pointermove", continueLine);
window.addEventListener("pointerup", endLine);
window.addEventListener("pointercancel", endLine);
window.addEventListener("resize", fitCanvasToWindow);
fitCanvasToWindow();
