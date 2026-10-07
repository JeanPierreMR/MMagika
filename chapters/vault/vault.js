// CHAPTER 1 — THE VAULT
//
// What starts it:  the page loading.
// What it does:
//   1. dresses the scene: rivets around the door and dust drifting in the air. All placed by a "looks random" pattern,
//      so the scene is the same on every visit.
//   2. moves the layers a little with the mouse, for depth.
//   3. makes the twelve dials (combination_dials.js). Pressing Enter or clicking the wheel
//      sends the combination to the site, which says whether it's right:
//        right  → the dials light up, the bolts slide back, the wheel spins, light leaks round
//                 the door, the doorway glows and the whole view burns out white, and the next chapter begins;
//        wrong  → the dials shudder with a dull clank;
//        jammed → too many tries this minute; wait.
// Sounds:          the room's low wind ("vault.room"), dial ticks, the clank and the opening, all in
//                  shared/sound_orchestra/sound_book.js.
// What changes:    the site remembers the vault is open (so the next chapter can be entered).

import { makeRandom } from "../shared/looks_random.js";
import { cue, fadeEverythingOut, stopCue } from "../shared/sound_orchestra/orchestra.js";
import { playClank, playVaultOpening } from "../shared/sounds.js";
import { tellTheSite } from "../shared/tell_the_site.js";
import { makeDials } from "./combination_dials.js";

// The dials, left to right: D = a dial of digits (0–9), L = a dial of letters (A–Z).
// The combination itself is only known to the site (VAULT_COMBINATION, site_security/security_settings.py).
const DIAL_KINDS = "DDLLDDDDDDDD";
const OPENING_TIME = 4000;      // ms from "right" until the view is white; see vault.css
const HANDOVER_TIME = 1600;     // ms then: the sound fades out and the white fades to dark, before the next chapter

const scene = document.getElementById("vault-scene");
const status = document.getElementById("lock-status");
const motionIsReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- Dressing the scene ---------------------------------------------------------------------
function placeRivets() {
  const rivets = scene.querySelector(".rivets");
  for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2;
    const rivet = document.createElement("i");
    rivet.className = "rivet";
    rivet.style.left = `${50 + Math.cos(angle) * 44}%`;
    rivet.style.top = `${50 + Math.sin(angle) * 44}%`;
    rivets.appendChild(rivet);
  }
}

function raiseDust() {
  const dust = scene.querySelector(".dust");
  const random = makeRandom(77);
  for (let i = 0; i < 26; i++) {
    const mote = document.createElement("i");
    mote.className = "mote";
    mote.style.left = `${random() * 100}%`;
    mote.style.top = `${random() * 100}%`;
    mote.style.setProperty("--size", `${1 + random() * 2.5}px`);
    mote.style.setProperty("--time", `${14 + random() * 16}s`);
    mote.style.setProperty("--delay", `${-random() * 20}s`);
    mote.style.setProperty("--dx", `${(random() - 0.5) * 160}px`);
    mote.style.setProperty("--dy", `${-40 - random() * 120}px`);   // dust rises slowly in warm air
    dust.appendChild(mote);
  }
}

// ---- Depth: layers drift with the mouse --------------------------------------------------------
function followTheMouse() {
  if (motionIsReduced) return;
  let pending = null;
  window.addEventListener("pointermove", (event) => {
    pending = [event.clientX / window.innerWidth * 2 - 1, event.clientY / window.innerHeight * 2 - 1];
    requestAnimationFrame(() => {
      if (!pending) return;
      scene.style.setProperty("--px", pending[0].toFixed(3));
      scene.style.setProperty("--py", pending[1].toFixed(3));
      pending = null;
    });
  });
}

// ---- Trying the combination ----------------------------------------------------------------------
let trying = false;

async function tryTheCombination() {
  if (trying) return;
  trying = true;
  dials.lock(true);
  const answer = await tellTheSite("/vault/open", { combination: dials.combination() }).catch(() => ({}));

  if (answer.opened) {
    status.textContent = "ACCESS GRANTED";
    status.className = "lock-status is-granted";
    dials.glow();
    playVaultOpening();
    stopCue("vault.room", { fade: 2.5 });       // the room's wind gives way to the opening
    scene.classList.add("is-opening");
    // Once all is white: the sound fades out and the white fades to dark, then the next chapter opens
    // (and fades in from dark), so the handover feels seamless.
    setTimeout(() => {
      fadeEverythingOut(HANDOVER_TIME / 1000);
      scene.classList.add("is-handing-over");
      setTimeout(() => window.location.assign(answer.next), HANDOVER_TIME);
    }, motionIsReduced ? 600 : OPENING_TIME);
    return;
  }
  playClank();
  dials.shake();
  status.textContent = answer.jammed ? "THE LOCK IS JAMMED · WAIT A MINUTE" : "ACCESS DENIED";
  status.className = "lock-status is-denied";
  setTimeout(() => {
    trying = false;
    dials.lock(false);
  }, answer.jammed ? 4000 : 900);
}

cue("vault.room");                              // fades in (on the first touch, if the browser waits for one)
placeRivets();
raiseDust();
followTheMouse();
const dials = makeDials(document.getElementById("dials"), { kinds: DIAL_KINDS, onEnter: tryTheCombination });
document.getElementById("turn-the-wheel").addEventListener("click", tryTheCombination);
