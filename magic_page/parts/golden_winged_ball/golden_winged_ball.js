// THE GOLDEN WINGED BALL
//
// What starts it:  the page loading.
// What it does, in two moods:
//   1. SHY (from the start): it flutters about, always keeping away from the mouse.
//      Come close and it darts off; it also keeps away from the screen's edges.
//   2. FREE (once the scroll opens; the healing spell calls letBallFlyFreely()):
//      it swoops and loops around the whole screen on its own path, as before.
// What changes:    only its position on screen.

const ballLayer = document.getElementById("golden-winged-ball");
const ball = ballLayer.querySelector(".ball");
const shimmers = [...ballLayer.querySelectorAll(".shimmer")];
const motionIsReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// How shy it is (distances in pixels, speeds in pixels per second).
const FEELS_THE_MOUSE_WITHIN = 320;
const FLEE_STRENGTH = 2600;
const EDGE_MARGIN = 90;
const TOP_SPEED = 560;

let mood = "shy";
let position = { x: window.innerWidth * 0.8, y: window.innerHeight * 0.2 };
let speed = { x: 0, y: 0 };
let wanderHeading = Math.random() * Math.PI * 2;     // the direction it drifts when nothing scares it
let mouse = { x: -9999, y: -9999 };                  // off-screen until the mouse first moves
let freeFlightTime = 0;                              // "time" along the free flight path
let freeFlightBlend = 0;                             // 0 → 1: eases from where it was onto the free path
let hoverUntil = 0;
let lastFrame = performance.now();
const recentPositions = [];                          // where the ball was over the last few frames (for the shimmer)

window.addEventListener("pointermove", (event) => { mouse = { x: event.clientX, y: event.clientY }; });
document.addEventListener("pointerleave", () => { mouse = { x: -9999, y: -9999 }; });

// ---- Mood 1: shy -------------------------------------------------------------------------
// Each frame, a few "pushes" are added to its speed: a gentle wandering push, a strong push
// away from the mouse (stronger the closer the mouse is), and pushes away from the edges.
function flyShyly(seconds) {
  wanderHeading += (Math.random() - 0.5) * 3 * seconds;
  let pushX = Math.cos(wanderHeading) * 90;
  let pushY = Math.sin(wanderHeading) * 90;

  const awayX = position.x - mouse.x;
  const awayY = position.y - mouse.y;
  const distance = Math.hypot(awayX, awayY) || 1;
  if (distance < FEELS_THE_MOUSE_WITHIN) {
    const fear = 1 - distance / FEELS_THE_MOUSE_WITHIN;          // 0 far away … 1 right on top of it
    pushX += (awayX / distance) * FLEE_STRENGTH * fear;
    pushY += (awayY / distance) * FLEE_STRENGTH * fear;
  }

  // Walls: the nearer an edge, the harder it is pushed back towards the middle.
  // (This also stops it being trapped in a corner: it slides along the wall and escapes.)
  const w = window.innerWidth, h = window.innerHeight;
  if (position.x < EDGE_MARGIN) pushX += (EDGE_MARGIN - position.x) * 40;
  if (position.x > w - EDGE_MARGIN) pushX -= (position.x - (w - EDGE_MARGIN)) * 40;
  if (position.y < EDGE_MARGIN) pushY += (EDGE_MARGIN - position.y) * 40;
  if (position.y > h - EDGE_MARGIN) pushY -= (position.y - (h - EDGE_MARGIN)) * 40;

  speed.x += pushX * seconds;
  speed.y += pushY * seconds;
  const slowDown = Math.exp(-1.8 * seconds);                     // air resistance
  speed.x *= slowDown;
  speed.y *= slowDown;
  const currentSpeed = Math.hypot(speed.x, speed.y);
  if (currentSpeed > TOP_SPEED) {
    speed.x *= TOP_SPEED / currentSpeed;
    speed.y *= TOP_SPEED / currentSpeed;
  }
  position.x += speed.x * seconds;
  position.y += speed.y * seconds;
}

// ---- Mood 2: free ----------------------------------------------------------------------------
// Its path: the middle of the screen plus a few waves of different sizes and speeds added
// together (numbers chosen by eye), so it swoops and loops without an obvious repeat.
function positionOnFreePath(time) {
  const w = window.innerWidth, h = window.innerHeight;
  return {
    x: w / 2 + w * 0.34 * Math.sin(time * 0.61) + w * 0.08 * Math.sin(time * 2.3),
    y: h / 2 + h * 0.3 * Math.sin(time * 0.83 + 1) + h * 0.07 * Math.cos(time * 3.1),
  };
}

function flyFreely(seconds, now) {
  if (now > hoverUntil) {
    freeFlightTime += seconds;
    if (Math.random() < 0.004) hoverUntil = now + 500 + Math.random() * 900;   // sometimes stop and hover
  }
  // Ease from wherever it was onto the path over about two seconds, instead of jumping.
  freeFlightBlend = Math.min(1, freeFlightBlend + seconds / 2);
  const onPath = positionOnFreePath(freeFlightTime);
  position.x += (onPath.x - position.x) * freeFlightBlend;
  position.y += (onPath.y - position.y) * freeFlightBlend;
}

// ---- Every frame ---------------------------------------------------------------------------------
function fly(now) {
  const seconds = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (mood === "shy") flyShyly(seconds); else flyFreely(seconds, now);

  const bob = Math.sin(now / 160) * 3;                            // a little flutter up and down
  const previous = recentPositions[0] || position;
  const lean = Math.max(-25, Math.min(25, (position.x - previous.x) * 1.5));   // lean into the direction of travel
  ball.style.transform = `translate(${position.x}px, ${position.y + bob}px) rotate(${lean}deg)`;

  // The shimmer glows sit where the ball was a few frames ago, each fainter than the last.
  recentPositions.unshift({ x: position.x, y: position.y });
  recentPositions.length = Math.min(recentPositions.length, 24);
  shimmers.forEach((shimmer, index) => {
    const spot = recentPositions[Math.min(recentPositions.length - 1, (index + 1) * 5)];
    shimmer.style.transform = `translate(${spot.x}px, ${spot.y}px)`;
    shimmer.style.opacity = String(0.7 - index * 0.16);
  });
  requestAnimationFrame(fly);
}

export function letBallFlyFreely() {
  if (mood === "free") return;
  mood = "free";
  // flyFreely() eases the ball from where it is onto its path over two seconds, so there's no jump.
  freeFlightTime = 0;
  freeFlightBlend = 0;
}

if (motionIsReduced) {
  // No flying: it rests quietly in the upper right.
  ball.style.transform = `translate(${position.x}px, ${position.y}px)`;
  shimmers.forEach((shimmer) => (shimmer.hidden = true));
} else {
  requestAnimationFrame(fly);
}
