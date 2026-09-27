// THE LIGHTNING FLASH
//
// What starts it:  the spellbook, when someone draws a zigzag: flashLightning().
// What it does:    the screen flashes white-violet twice and the page gives a small jolt.

const flash = document.getElementById("lightning-flash");

export function flashLightning() {
  // Hiding and showing again restarts the flash if one is already happening.
  flash.hidden = true;
  void flash.offsetWidth;           // makes the browser notice it was hidden
  flash.hidden = false;
  setTimeout(() => (flash.hidden = true), 1200);

  document.body.classList.remove("is-shaking");
  void document.body.offsetWidth;
  document.body.classList.add("is-shaking");
}
