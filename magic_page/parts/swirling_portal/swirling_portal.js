// THE SWIRLING PORTAL
//
// What starts it:  the spellbook, when someone draws a spiral: openSwirlingPortal({x, y}).
// What it does:    a spinning purple portal grows at the middle of the spiral,
//                  swirls for about 3 seconds, then shrinks away.

const portal = document.getElementById("swirling-portal");
let closeTimer = null;

export function openSwirlingPortal(centre) {
  portal.style.left = centre.x + "px";
  portal.style.top = centre.y + "px";

  // Hiding and showing again restarts the CSS animation if a portal is already open.
  portal.hidden = true;
  void portal.offsetWidth;          // makes the browser notice the portal was hidden
  portal.hidden = false;

  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => (portal.hidden = true), 3000);
}
