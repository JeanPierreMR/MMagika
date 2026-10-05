// THE COMBINATION DIALS — a row of rotating drums, like a cryptex, one character each.
//
// What starts it:  vault.js calls makeDials() when the page loads.
// What it does:    builds each dial as a real 3D drum, of digits (0–9) or of letters (A–Z) as
//                  "kinds" says, and lets the visitor turn it by:
//                    - the mouse wheel, or dragging it up and down (mouse or finger),
//                    - tapping its top half (back one) or bottom half (on one),
//                    - the arrow keys, or simply typing the character (focus moves to the next dial).
//                  Every time a dial clicks onto a character, it ticks.
// What it gives back: the dials' current combination, and ways to show success, failure or a jam.
// Each dial is a "spinbutton" for screen readers, so the lock works without seeing the drums.

import { playTick } from "../shared/sounds.js";

// What's on each kind of dial: "D" = digits, "L" = letters.
const KINDS_OF_DIAL = { D: "0123456789", L: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" };
const WHEEL_STEP = 40;                           // how much mouse-wheel scrolling turns one step

// kinds: one letter per dial, e.g. "DDLLDDDDDDDD" (two digit dials, two letter dials, eight digit dials).
export function makeDials(container, { kinds, onEnter }) {
  const dials = [];
  const count = kinds.length;

  for (let number = 0; number < count; number++) {
    const CHARACTERS = KINDS_OF_DIAL[kinds[number]];
    const STEP_ANGLE = 360 / CHARACTERS.length;
    const dial = document.createElement("div");
    dial.className = "dial";
    dial.tabIndex = 0;
    dial.setAttribute("role", "spinbutton");
    dial.setAttribute("aria-label", `Dial ${number + 1} of ${count}`);
    const drum = document.createElement("div");
    drum.className = "drum";
    for (let i = 0; i < CHARACTERS.length; i++) {
      const face = document.createElement("span");
      face.className = "face";
      face.textContent = CHARACTERS[i];
      face.style.setProperty("--angle", `${-i * STEP_ANGLE}deg`);   // each face around the drum
      drum.appendChild(face);
    }
    dial.appendChild(drum);
    container.appendChild(dial);

    // 26 letters need a bigger drum than 10 digits (see .dial.letters in vault.css).
    if (kinds[number] === "L") dial.classList.add("letters");
    const state = { dial, drum, position: 0, shown: 0, characters: CHARACTERS, stepAngle: STEP_ANGLE };
    dials.push(state);
    show(state, false);
    listenTo(state, number);
  }

  // Which face of the drum is at the front.
  function wrap(state) {
    const n = state.characters.length;
    return ((Math.round(state.position) % n) + n) % n;
  }

  // Turn the drum to the dial's position. "smoothly" glides there; dragging follows the finger directly.
  function show(state, smoothly = true) {
    state.drum.classList.toggle("is-gliding", smoothly);
    state.drum.style.setProperty("--turn", `${state.position * state.stepAngle}deg`);
    const shown = wrap(state);
    if (shown !== state.shown) {
      state.shown = shown;
      playTick();
    }
    state.dial.setAttribute("aria-valuetext", state.characters[shown]);
  }

  function turn(state, steps) {
    state.position = Math.round(state.position) + steps;
    show(state);
  }

  function focusDial(index) {
    dials[Math.max(0, Math.min(count - 1, index))].dial.focus();
  }

  function listenTo(state, index) {
    const { dial } = state;
    let wheelSoFar = 0;
    dial.addEventListener("wheel", (event) => {
      event.preventDefault();
      wheelSoFar += event.deltaY;
      while (Math.abs(wheelSoFar) >= WHEEL_STEP) {
        turn(state, Math.sign(wheelSoFar));
        wheelSoFar -= Math.sign(wheelSoFar) * WHEEL_STEP;
      }
    }, { passive: false });

    // Dragging up or down turns the drum; a quick tap without dragging steps once.
    let drag = null;
    dial.addEventListener("pointerdown", (event) => {
      dial.setPointerCapture(event.pointerId);
      drag = { startY: event.clientY, startPosition: state.position, moved: false, faceHeight: dial.clientHeight / 3 };
    });
    dial.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const distance = drag.startY - event.clientY;
      if (Math.abs(distance) > 4) drag.moved = true;
      state.position = drag.startPosition + distance / drag.faceHeight;
      show(state, false);
    });
    const endDrag = (event) => {
      if (!drag) return;
      if (drag.moved) {
        state.position = Math.round(state.position);
        show(state);
      } else {
        const box = dial.getBoundingClientRect();
        turn(state, event.clientY < box.top + box.height / 2 ? -1 : 1);
      }
      drag = null;
    };
    dial.addEventListener("pointerup", endDrag);
    dial.addEventListener("pointercancel", endDrag);

    dial.addEventListener("keydown", (event) => {
      const typed = event.key.length === 1 ? event.key.toUpperCase() : "";
      if (event.key === "ArrowUp") { turn(state, -1); event.preventDefault(); }
      else if (event.key === "ArrowDown") { turn(state, 1); event.preventDefault(); }
      else if (event.key === "ArrowLeft" || event.key === "Backspace") { focusDial(index - 1); event.preventDefault(); }
      else if (event.key === "ArrowRight") { focusDial(index + 1); event.preventDefault(); }
      else if (event.key === "Enter") { onEnter(); event.preventDefault(); }
      else if (typed !== "" && state.characters.includes(typed)) {
        // Turn the shortest way round to the typed character. (A letter typed on a digit dial, or
        // the other way round, does nothing.)
        const n = state.characters.length;
        let steps = state.characters.indexOf(typed) - wrap(state);
        if (steps > n / 2) steps -= n;
        if (steps < -n / 2) steps += n;
        turn(state, steps);
        focusDial(index + 1);
        event.preventDefault();
      }
    });
  }

  return {
    combination: () => dials.map((state) => state.characters[wrap(state)]).join(""),
    // The lock opened: each dial lights up, one after another.
    glow() {
      dials.forEach((state, i) => setTimeout(() => state.dial.classList.add("is-right"), i * 70));
    },
    // Wrong: the dials shudder.
    shake() {
      container.classList.remove("is-shaking");
      void container.offsetWidth;                  // restart the animation
      container.classList.add("is-shaking");
    },
    lock(locked) {
      dials.forEach((state) => state.dial.setAttribute("aria-disabled", String(locked)));
      container.classList.toggle("is-locked", locked);
    },
  };
}
