// WATCHING EYES
//
// What starts it:  the page loading.
// What it does:    keeps 1 pair of eyes going. Again and again, it:
//                  slowly appears somewhere in a dark corner, opens its eyes, watches the
//                  mouse for a while (blinking slowly now and then), closes and fades,
//                  waits in the dark, then appears somewhere else. Mysterious, not busy.
// What it uses:    the "pair-of-eyes" template in watching_eyes.html, and the mouse position.
// What changes:    only what's on screen; nothing is saved.

const NUMBER_OF_WATCHERS = 1;
const HOW_FAR_PUPILS_MOVE_SIDEWAYS = 6;   // in the drawing's own units (an eye is 44 units wide)
const HOW_FAR_PUPILS_MOVE_UP_DOWN = 2;

const eyesLayer = document.getElementById("watching-eyes");
const pairOfEyesStamp = document.getElementById("pair-of-eyes");
const watchers = [];
let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function randomBetween(smallest, largest) {
  return smallest + Math.random() * (largest - smallest);
}

// Make one pair of eyes from the template and put it on the page (still invisible).
function createWatcher(number) {
  const copy = pairOfEyesStamp.content.firstElementChild.cloneNode(true);
  // Each copy needs its own names for its clip shapes, or they would clash:
  // "left-eye-shape__" becomes "left-eye-shape-1", "left-eye-shape-2", ...
  for (const shape of copy.querySelectorAll("clipPath")) {
    shape.id = shape.id.replace("__", "-" + number);
  }
  for (const clipped of copy.querySelectorAll("[clip-path]")) {
    clipped.setAttribute("clip-path", clipped.getAttribute("clip-path").replace("__", "-" + number));
  }
  eyesLayer.appendChild(copy);
  return {
    element: copy,
    eyes: [...copy.querySelectorAll(".eye-glow")],
    pupils: [...copy.querySelectorAll(".pupil")],
  };
}

// Choose a spot in one of the four dark corners, not too close to another pair of eyes.
function moveToRandomDarkCorner(watcher) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const onLeft = Math.random() < 0.5;
    const onTop = Math.random() < 0.5;
    const fromSide = randomBetween(0.03, 0.2) * window.innerWidth;
    const fromTopOrBottom = randomBetween(0.04, 0.24) * window.innerHeight;
    const width = watcher.element.offsetWidth || 120;
    const x = onLeft ? fromSide : window.innerWidth - fromSide - width;
    const y = onTop ? fromTopOrBottom : window.innerHeight - fromTopOrBottom - width * 0.7;

    const tooClose = watchers.some((other) =>
      other !== watcher && other.x !== undefined && Math.hypot(other.x - x, other.y - y) < width * 1.4);
    if (!tooClose || attempt === 11) {
      watcher.x = x;
      watcher.y = y;
      watcher.element.style.left = x + "px";
      watcher.element.style.top = y + "px";
      return;
    }
  }
}

// Point both pupils towards the mouse.
function lookAtMouse(watcher) {
  watcher.eyes.forEach((eye, index) => {
    const box = eye.getBoundingClientRect();
    const eyeCentreX = box.left + box.width / 2;
    const eyeCentreY = box.top + box.height / 2;
    const distance = Math.hypot(mouse.x - eyeCentreX, mouse.y - eyeCentreY) || 1;
    // The closer the mouse, the less the pupil needs to turn; far away it looks right at the edge.
    const reach = Math.min(1, distance / 300);
    const moveX = ((mouse.x - eyeCentreX) / distance) * HOW_FAR_PUPILS_MOVE_SIDEWAYS * reach;
    const moveY = ((mouse.y - eyeCentreY) / distance) * HOW_FAR_PUPILS_MOVE_UP_DOWN * reach;
    watcher.pupils[index].setAttribute("transform", `translate(${moveX.toFixed(2)} ${moveY.toFixed(2)})`);
  });
}

// A slow, lazy blink: the lids take half a second to close, rest shut, then open again.
async function blink(watcher) {
  watcher.element.classList.add("is-blinking");
  await wait(750);
  watcher.element.classList.remove("is-blinking");
}

// One watcher's endless routine: appear, watch, blink, disappear, move.
async function keepWatching(watcher) {
  await wait(randomBetween(1500, 9000));          // start at different times
  while (true) {
    moveToRandomDarkCorner(watcher);
    lookAtMouse(watcher);
    watcher.element.classList.add("is-awake");     // fades in slowly, then the eyes open (see the CSS)
    await wait(3000);

    const watchUntil = Date.now() + randomBetween(6000, 11000);
    while (Date.now() < watchUntil) {
      await wait(randomBetween(3500, 7000));
      await blink(watcher);
    }

    watcher.element.classList.remove("is-awake");  // eyes close and fade away
    await wait(randomBetween(5000, 12000));        // a long, dark wait before appearing again
  }
}

window.addEventListener("pointermove", (event) => {
  mouse = { x: event.clientX, y: event.clientY };
  for (const watcher of watchers) {
    if (watcher.element.classList.contains("is-awake")) {
      lookAtMouse(watcher);
    }
  }
});

for (let number = 1; number <= NUMBER_OF_WATCHERS; number++) {
  const watcher = createWatcher(number);
  watchers.push(watcher);
  keepWatching(watcher);
}
