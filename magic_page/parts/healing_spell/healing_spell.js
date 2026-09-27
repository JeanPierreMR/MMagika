// THE HEALING SPELL — the main story of the page.
//
// What starts it:  drawing a red cross or a red triangle (the spellbook calls castHealingSpell).
// What it does, in order:
//   1. pauses a moment, so the visitor sees their drawing turn gold
//   2. the background becomes a slideshow of medical history, oldest first
//   3. a golden winged ball starts flying around
//   4. the stars turn into small coloured crosses
//   5. the wax seal breaks and the scroll opens: "Live with all your heart"
// What changes:    the page, for the rest of the visit. Nothing is saved; reloading starts over.
// If a step fails: the others still run (for example, if a picture can't load,
//                  the slideshow simply skips it).

import { turnBackgroundIntoMedicalHistory } from "../medical_history/medical_history.js";
import { releaseGoldenWingedBall } from "../golden_winged_ball/golden_winged_ball.js";
import { turnStarsIntoColouredCrosses } from "../night_sky/night_sky.js";
import { openScrollWithMessage } from "../scroll_and_wax_seal/scroll_and_wax_seal.js";

let alreadyCast = false;

export async function castHealingSpell() {
  if (alreadyCast) return;          // the story happens once per visit
  alreadyCast = true;

  await wait(1000);
  turnBackgroundIntoMedicalHistory();

  await wait(1500);
  releaseGoldenWingedBall();
  turnStarsIntoColouredCrosses();

  await wait(1000);
  openScrollWithMessage("Live with all your heart");
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
