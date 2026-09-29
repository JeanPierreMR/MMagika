// THE HEALING SPELL — the main story of the page.
//
// What starts it:  drawing a cross (lines or silhouette) or a triangle
//                  (the spellbook calls castHealingSpell).
// What it does, in order:
//   1. pauses a moment, so the visitor sees their drawing turn gold and glitter
//   2. the stars turn into small coloured crosses
//   3. memories of medicine flood the screen one after another, overlapping (about 12 seconds)
//   4. the memories settle into the background, smaller, drifting in and out
//   5. the wax seal breaks and the black scroll opens, showing the letter in gold
//   6. the golden winged ball stops fleeing the mouse and flies freely
// What changes:    the page, for the rest of the visit. Nothing is saved; reloading starts over.
// If a step fails: the others still run (for example, if a picture can't load, its turn is blank).

import { turnStarsIntoColouredCrosses } from "../night_sky/night_sky.js";
import { floodWithMemories, keepMemoriesInBackground } from "../medical_history/medical_history.js";
import { openScrollAndShowLetter } from "../scroll_and_wax_seal/scroll_and_wax_seal.js";
import { letBallFlyFreely } from "../golden_winged_ball/golden_winged_ball.js";

let alreadyCast = false;

export async function castHealingSpell() {
  if (alreadyCast) return;          // the story happens once per visit
  alreadyCast = true;

  await wait(1000);
  turnStarsIntoColouredCrosses();
  await floodWithMemories();        // waits until the flood is over

  keepMemoriesInBackground();
  letBallFlyFreely();
  await openScrollAndShowLetter();
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
