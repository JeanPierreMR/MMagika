// THE SPELLBOOK — which drawing casts which spell.
//
// What starts it:  the wand, when a drawing is finished (see wand.js).
// What it uses:    the drawing: a list of lines, each a list of {x, y} points.
// What it does:    asks the shape reader what shape it was, then casts the matching spell:
//                    cross or triangle          → the healing spell (the main story)
//                    spiral                     → a swirling portal where you drew it
//                    zigzag                     → a flash of lightning
// What it returns: true if a spell was cast (the wand then fades the drawing in gold),
//                  false if the drawing wasn't a spell (it just fades away in green).

import { recognizeShape } from "./shape_reader.js";
import { castHealingSpell } from "../healing_spell/healing_spell.js";
import { openSwirlingPortal } from "../swirling_portal/swirling_portal.js";
import { flashLightning } from "../lightning_flash/lightning_flash.js";

export function whenDrawingFinished(drawing) {
  const shape = recognizeShape(drawing);

  if (shape === "cross" || shape === "triangle") {
    castHealingSpell();
    return true;
  }
  if (shape === "spiral") {
    openSwirlingPortal(centreOf(drawing));
    return true;
  }
  if (shape === "zigzag") {
    flashLightning();
    return true;
  }
  return false;
}

// The middle of the drawing, so the portal opens where the spiral was drawn.
function centreOf(drawing) {
  const points = drawing.flat();
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}
