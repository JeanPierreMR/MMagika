// THE SHAPE READER — works out what shape someone drew.
//
// It uses the "$P recognizer" (borrowed, see magic_page/vendor/pdollar.js).
// $P compares a drawing with example shapes and says which example it is closest to,
// with a score from 0 (nothing alike) to 1 (identical). It doesn't care about the size
// of the drawing, where on screen it is, which direction the lines were drawn in,
// or how many separate lines were used (so a two-line cross works).
//
// $P comes with 16 example shapes of its own (letters T, N, D, P, X, H, I, a line,
// stars, ...). We keep them: if a scribble looks most like a "T", it simply isn't
// one of our spells, instead of being wrongly squeezed into the nearest spell.
//
// $P's own pieces used here (defined in pdollar.js):
//   new PDollarRecognizer()           the recognizer, with its 16 example shapes
//   recognizer.AddGesture(name, pts)  add one more example shape
//   recognizer.Recognize(pts)         find the closest example: { Name, Score }
//   new Point(x, y, lineNumber)       one point; lineNumber says which line it belongs to

// Matches weaker than this count as "nothing". Tested with wobbly hand-drawn shapes:
// every cross, triangle, spiral and zigzag passed; straight lines, circles and squares didn't.
const MINIMUM_SCORE = 0.1;
const MINIMUM_POINTS = 12;   // a tiny dab isn't a shape

// Which of $P's answers mean which of our shapes. Anything else means "nothing".
const OUR_SHAPES = {
  "cross": "cross",
  "cross outline": "cross",
  "triangle": "triangle",
  "spiral": "spiral",
  "zigzag": "zigzag",
  "lightning bolt": "zigzag",
};

const recognizer = new PDollarRecognizer();

// ---- Our example shapes ------------------------------------------------------
// Each example is described by its corner points on a 100 × 100 grid.
// pointsAlong() fills in the points between the corners.

function pointsAlong(corners, lineNumber) {
  const points = [];
  for (let i = 0; i < corners.length - 1; i++) {
    const [fromX, fromY] = corners[i];
    const [toX, toY] = corners[i + 1];
    for (let step = 0; step < 10; step++) {
      const t = step / 10;
      points.push(new Point(fromX + (toX - fromX) * t, fromY + (toY - fromY) * t, lineNumber));
    }
  }
  const [lastX, lastY] = corners[corners.length - 1];
  points.push(new Point(lastX, lastY, lineNumber));
  return points;
}

// A triangle, drawn as one closed line.
recognizer.AddGesture("triangle", pointsAlong([[50, 0], [100, 86], [0, 86], [50, 0]], 1));

// A cross ("+"), drawn as two lines: one down, one across.
recognizer.AddGesture("cross", [
  ...pointsAlong([[50, 0], [50, 100]], 1),
  ...pointsAlong([[0, 50], [100, 50]], 2),
]);

// A cross silhouette: the outline of a "+", like the red cross symbol, in one line.
recognizer.AddGesture("cross outline", pointsAlong([
  [35, 0], [65, 0], [65, 35], [100, 35], [100, 65], [65, 65],
  [65, 100], [35, 100], [35, 65], [0, 65], [0, 35], [35, 35], [35, 0],
], 1));

// A spiral: three turns, starting in the middle and getting wider.
const spiralPoints = [];
for (let step = 0; step <= 90; step++) {
  const turnsSoFar = (step / 90) * 3;
  const angle = turnsSoFar * 2 * Math.PI;
  const radius = 4 + (step / 90) * 46;
  spiralPoints.push(new Point(50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle), 1));
}
recognizer.AddGesture("spiral", spiralPoints);

// A zigzag going across, and a lightning bolt going down. Both count as "zigzag".
recognizer.AddGesture("zigzag", pointsAlong([[0, 30], [20, 70], [40, 30], [60, 70], [80, 30], [100, 70]], 1));
recognizer.AddGesture("lightning bolt", pointsAlong([[65, 0], [30, 50], [70, 50], [35, 100]], 1));

// Decoys: plain straight lines, which people draw by accident all the time.
// Without these, a single slanted line looks like half of $P's "X" or half of our cross.
recognizer.AddGesture("slanted line", pointsAlong([[0, 0], [100, 100]], 1));
recognizer.AddGesture("slanted line", pointsAlong([[100, 0], [0, 100]], 1));
recognizer.AddGesture("upright line", pointsAlong([[50, 0], [50, 100]], 1));

// ---- Reading a drawing ------------------------------------------------------------
// drawing: a list of lines, each line a list of {x, y} points (as the wand records them).
// Returns "cross", "triangle", "spiral", "zigzag" or "nothing".
export function recognizeShape(drawing) {
  const points = [];
  drawing.forEach((line, index) => {
    for (const point of line) points.push(new Point(point.x, point.y, index + 1));
  });
  if (points.length < MINIMUM_POINTS) return "nothing";

  const bestMatch = recognizer.Recognize(points);
  if (bestMatch.Score < MINIMUM_SCORE) return "nothing";
  return OUR_SHAPES[bestMatch.Name] || "nothing";
}
