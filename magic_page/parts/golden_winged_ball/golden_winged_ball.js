// THE GOLDEN WINGED BALL
//
// What starts it:  the healing spell calls releaseGoldenWingedBall().
// What it does:    the ball enters from the top of the screen and flies around forever.
//                  Its path is made of several slow waves added together, so it swoops
//                  and loops without ever repeating in an obvious way. Now and then it
//                  hovers in place for a moment, then darts off again.
// What changes:    only its position on screen.

const ballLayer = document.getElementById("golden-winged-ball");
const ball = ballLayer.querySelector(".ball");
const shimmers = [...ballLayer.querySelectorAll(".shimmer")];

const motionIsReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const recentPositions = [];      // where the ball was over the last few frames (for the shimmer)
let flightTime = 0;              // "time" along the flight path; it stands still while hovering
let hoverUntil = 0;
let lastFrame = performance.now();

// Where the ball is at a moment along its path: the middle of the screen,
// plus a few waves of different sizes and speeds (all numbers chosen by eye).
function positionOnFlightPath(time) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  return {
    x: width / 2 + width * 0.34 * Math.sin(time * 0.61) + width * 0.08 * Math.sin(time * 2.3),
    y: height / 2 + height * 0.3 * Math.sin(time * 0.83 + 1) + height * 0.07 * Math.cos(time * 3.1),
  };
}

function fly(now) {
  const secondsSinceLastFrame = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  if (now > hoverUntil) {
    flightTime += secondsSinceLastFrame;
    if (Math.random() < 0.004) hoverUntil = now + 500 + Math.random() * 900;   // sometimes stop and hover
  }

  const { x, y } = positionOnFlightPath(flightTime);
  const wobble = now < hoverUntil ? Math.sin(now / 90) * 3 : 0;   // a small bob while hovering

  // Lean a little in the direction it's moving.
  const previous = recentPositions[0] || { x, y };
  const lean = Math.max(-25, Math.min(25, (x - previous.x) * 1.5));
  ball.style.transform = `translate(${x}px, ${y + wobble}px) rotate(${lean}deg)`;

  // The shimmer glows sit where the ball was a few frames ago, each fainter than the last.
  recentPositions.unshift({ x, y });
  recentPositions.length = Math.min(recentPositions.length, 24);
  shimmers.forEach((shimmer, index) => {
    const spot = recentPositions[Math.min(recentPositions.length - 1, (index + 1) * 5)];
    shimmer.style.transform = `translate(${spot.x}px, ${spot.y}px)`;
    shimmer.style.opacity = String(0.7 - index * 0.16);
  });

  requestAnimationFrame(fly);
}

export function releaseGoldenWingedBall() {
  if (!ballLayer.hidden) return;   // already flying
  ballLayer.hidden = false;
  if (motionIsReduced) {
    // No flying around: it simply hovers near the top of the scroll.
    ball.style.transform = `translate(${window.innerWidth / 2}px, ${window.innerHeight * 0.18}px)`;
    shimmers.forEach((shimmer) => (shimmer.hidden = true));
    return;
  }
  flightTime = -Math.PI / 2 / 0.83 - 1 / 0.83;   // start the path at its top edge, so it swoops in from above
  requestAnimationFrame(fly);
}
