// TELL THE SITE — how a chapter tells the site something ("the vault is open", "this chapter is
// over"), and moves on to the next chapter.
//
// The site only lets a visitor into a chapter once the earlier ones are finished, and it only
// believes messages that carry the page's secret token (protection against forged requests;
// see site_security/security_settings.py). The token is in the page's <head> (shared/page.html).

function secretToken() {
  return document.querySelector('meta[name="csrf-token"]').content;
}

// Send a message to the site and return its answer (an object), e.g. { opened: true, next: "/signal" }.
export async function tellTheSite(address, message = {}) {
  const response = await fetch(address, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": secretToken() },
    body: JSON.stringify(message),
  });
  const answer = await response.json().catch(() => ({}));
  return { ...answer, status: response.status };
}

// This chapter is over: tell the site, then open the next chapter.
export async function finishChapterAndGoOn(chapter) {
  const { next } = await tellTheSite(`/${chapter}/done`);
  window.location.assign(next || "/");
}
