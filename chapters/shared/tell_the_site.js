// TELL THE SITE — how a chapter tells the site something ("the vault is open", "this chapter is
// over"), and moves on to the next chapter.
//
// The site only lets a visitor into a chapter once the earlier ones are finished, and it only
// believes messages that carry the page's secret token (protection against forged requests;
// see site_security/security_settings.py). The token is in the page's <head> (shared/page.html).
//
// When the site can't be reached (no connection, or the server is still waking up):
//   - tellTheSite gives up after ANSWER_WITHIN and fails, so the page can say so;
//   - finishChapterAndGoOn keeps trying, and after a couple of tries shows a small notice
//     (.connection-notice in whole_page.css), so the visitor is never left on a dark screen
//     without a word. It goes on by itself the moment the site answers.

const ANSWER_WITHIN = 20000;            // ms to wait for one answer before giving up on it
const TRY_AGAIN_AFTER = [1000, 2500, 5000];   // ms before the 2nd, 3rd, 4th... try (the last one repeats)
const SAY_SO_AFTER = 2;                 // failed tries before the notice appears

function secretToken() {
  return document.querySelector('meta[name="csrf-token"]').content;
}

// Send a message to the site and return its answer (an object), e.g. { opened: true, next: "/signal" },
// with the answer's status number. Fails (throws) if the site can't be reached in time.
export async function tellTheSite(address, message = {}) {
  const response = await fetch(address, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": secretToken() },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(ANSWER_WITHIN),
  });
  const answer = await response.json().catch(() => ({}));
  return { ...answer, status: response.status };
}

function showConnectionNotice() {
  let notice = document.querySelector(".connection-notice");
  if (!notice) {
    notice = document.createElement("p");
    notice.className = "connection-notice";
    notice.setAttribute("role", "status");
    notice.textContent = "Connection lost · trying again…";
    document.body.appendChild(notice);
  }
}

// Wait, but not if the connection comes back first.
function waitOrBackOnline(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      window.removeEventListener("online", done);
      resolve();
    }
    window.addEventListener("online", done);
  });
}

// This chapter is over: tell the site, then open the next chapter. Keeps trying until the site answers.
export async function finishChapterAndGoOn(chapter) {
  for (let tries = 0; ; tries++) {
    const answer = await tellTheSite(`/${chapter}/done`).catch(() => null);
    // Answered: go where it says. (A refusal without "next" means the page's token or the visitor's
    // progress is gone; the front door sends them to the chapter they're really up to.)
    if (answer && (answer.next || answer.status < 500 && answer.status !== 429)) {
      window.location.assign(answer.next || "/");
      return;
    }
    if (tries + 1 >= SAY_SO_AFTER) showConnectionNotice();
    await waitOrBackOnline(TRY_AGAIN_AFTER[Math.min(tries, TRY_AGAIN_AFTER.length - 1)]);
  }
}
