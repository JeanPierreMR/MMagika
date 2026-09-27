// MEDICAL HISTORY — the background slideshow.
//
// What starts it:  the healing spell calls turnBackgroundIntoMedicalHistory().
// What it uses:    the pictures listed in medical_history.html, in that order (oldest first).
// What it does:    shows the pictures one after another, every few seconds. Each fades in
//                  while the one before is still fading out, so they overlap. After the
//                  last one (today's heartbeat) it starts again from the oldest.
// If a picture fails to load, it is skipped.

const TIME_PER_PICTURE = 3500;   // milliseconds

const slideshow = document.getElementById("medical-history");
const pictures = [...slideshow.querySelectorAll(".picture")];

// Leave out any picture whose image didn't load.
for (const image of slideshow.querySelectorAll("img")) {
  image.addEventListener("error", () => image.closest(".picture").classList.add("failed-to-load"));
}

let current = -1;

function showNextPicture() {
  let next = current;
  do {
    next = (next + 1) % pictures.length;
  } while (pictures[next].classList.contains("failed-to-load") && next !== current);

  if (current >= 0) pictures[current].classList.remove("is-showing");   // starts fading out
  pictures[next].classList.add("is-showing");                            // starts fading in
  current = next;
}

export function turnBackgroundIntoMedicalHistory() {
  if (!slideshow.hidden) return;    // already running
  for (const image of slideshow.querySelectorAll("img")) image.loading = "eager";   // fetch them all now
  slideshow.hidden = false;
  showNextPicture();
  setInterval(showNextPicture, TIME_PER_PICTURE);
}
