# The Dreamers

A short story told in four chapters, one web page each. You can't skip ahead: the site remembers how far you've got.

| Chapter | Address | What happens |
|---|---|---|
| 1. **The vault** | `/vault` | An old, rusty vault door in a concrete wall. Dust drifts in a flickering light, and a red handprint is smeared across it. Twelve rotating dials (digits and letters) hold the combination. The right one makes the bolts slide back and the wheel spin; the doorway glows with light from inside, and the whole view burns out white, like a camera pointed at the sun. |
| 2. **The signal** | `/signal` | First, the page asks for the microphone and won't go on without it. Then the whole page listens: a picture in the middle, the sound drawn around it as moving geometry, with the machine's calculations written over it. No instructions. When it hears the mockingjay's four notes (at a normal pace, 2 to 6 seconds), the bird sings them back, and everything goes dark. |
| 3. **The terminal** | `/terminal` | The machine crashes: a Linux kernel panic, stopping now and then as if the machine were busy, the screen tears, one second of black. Then a glitched futuristic terminal types the EverAfter mission file, Kids Next Door style, glitching as it goes; some lines show a progress bar while the machine works on them. A bright wipe: "Welcome Doctor · Starting letter", which flies up and fades. |
| 4. **The letter** | `/letter` | A clean holographic frame and a night sky. The dark scroll's seal bursts, it unrolls, and the Dreamers' letter writes itself in gold. Now and then the connection seems to fail: half the screen goes dark with green lines, or the picture breaks into grain. |

`/` sends you to the chapter you're up to.

---

## Where to start reading

The code is organised around **what you see**. Each chapter has one folder (`chapters/<chapter>/`) holding its HTML, CSS and JavaScript together. Each chapter's HTML file starts with a comment explaining what happens and what's where; start there.

- **[chapters/progress.py](chapters/progress.py)**: the chapters in order, and which ones a visitor has finished.
- **[chapters/views.py](chapters/views.py)**: the pages, plus the few messages a page sends to the site ("try this combination", "this chapter is done").
- **[chapters/shared/](chapters/shared/)**: things every chapter uses:
  - `page.html`, the page frame each chapter extends;
  - colours, fonts and sounds (all synthesized, no audio files);
  - the "looks random but isn't" helper;
  - `tell_the_site.js`.

Each JavaScript file starts by answering: *What starts it? What does it do? What changes?*

| Folder | What's in it |
|---|---|
| `chapters/vault/` | The door and the scene (`vault.css`), the dials (`combination_dials.js`), the opening (`vault.js`), and photo textures (CC0, credits in `image_credits.md`) |
| `chapters/signal/` | The microphone gate and the listening page. **The picture in the middle is `images/mockingjay.png`** (a placeholder: replace it, same name). How the call is recognised is explained at the top of `listen_for_the_call.js`; the drawing is `voice_geometry.js`; the bird's song is `bird_song.js` |
| `chapters/terminal/` | The crash (`kernel_panic.txt`; a `[wait 1500]` line pauses it), the script itself in `terminal.html` (edit the lines freely; `data-pause` and `data-working` set the pauses and progress bars), and the typing and glitches (`glitch_typing.js`) |
| `chapters/letter/` | The future frame, the night sky, the scroll, and the connection glitches (`connection_glitches.js`). **The letter's text is in `scroll_and_wax_seal/letter.html`**, with `[pausa]`, `[pausa larga]` and `[silencio]` where the pen stops; it's played from pre-rendered videos (see below) |

### Everything else

| Folder / file | What it is |
|---|---|
| `site_security/` | **All** the safety rules in one place: secret key, HTTPS, which scripts the browser may run, the request limit, the vault's combination and guess limit, sessions, forged-request protection, and which page may use the microphone. `tests.py` checks it all. |
| `site_settings/` | Django's wiring: which web address shows what (`urls.py`), where files live |
| `tools/letter_video/` | The **tuner** (try the letter's animation settings with a live preview) and the **renderer** that turns the letter into videos. See its README. |
| `tools/colour_field/` | How the colours flowing inside the letter are made |
| `Dockerfile`, `render.yaml` | How Render builds and runs the site |
| `docs/scaling.html` | How this could grow to 20 million users, Render vs AWS |

### Changing the letter

The letter is pre-rendered, so the browser only plays videos. After editing `letter.html`, or the animation settings in the tuner, render it again with one command (needs ffmpeg and Firefox or Chrome; it takes a while, about half an hour for the whole letter):

```bash
python3 tools/letter_video/save_videos.py render
```

The old videos stay in place until the new ones are all finished. More in [tools/letter_video/README.md](tools/letter_video/README.md).

---

## Run it on your computer

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
DJANGO_DEBUG=1 python manage.py runserver     # open http://127.0.0.1:8000
python manage.py test                         # the automatic checks
```

The combination on your computer is `12MD20262020`.

While you're working on one chapter, add `?skip` to its address (e.g. `/letter?skip`) to jump straight to it. Add `?profile` to measure what makes a page slow. Both work only in debug mode.

Or run exactly what Render runs:

```bash
docker build -t dreamers .
docker run --rm -p 10000:10000 -e DJANGO_SECRET_KEY=anything -e VAULT_COMBINATION=12MD20262020 dreamers   # open http://localhost:10000
```

## Put it on Render

1. Push this repository to GitHub.
2. In Render: **New → Blueprint** and pick the repository. Render reads `render.yaml` and builds the `Dockerfile`. It creates a secret key, and **asks you for `VAULT_COMBINATION`** (the vault's combination; it's only ever checked on the server). You get an address like `dreamers.onrender.com`.
3. Using your own domain? Set `DJANGO_ALLOWED_HOSTS=yourdomain.com` in Render's environment settings.

**After the first deploy, check one thing.** The request limits read the visitor's address from the first entry in the `X-Forwarded-For` header. Open the page from two different networks (for example Wi-Fi and phone data). If the second one gets "Too many requests" while the first is busy, adjust `find_visitor_ip_address` in `site_security/limit_requests_per_visitor.py`.

**Want real flood protection?** Put the site behind your own free Cloudflare account and add one rate-limiting rule. The in-app limits are a backstop, not a shield.

## Microphone and privacy

Only `/signal` may use the microphone. It is enforced by a `Permissions-Policy` header, and the browser asks first. The sound is analysed live in the browser to hear the notes; it is never recorded or sent anywhere. The microphone needs HTTPS (Render provides it) or `localhost`.

## Browsers

Built for current Chrome, Firefox and Safari. Checked in Chrome and Firefox; Safari still needs a check on an Apple device. People who turn on "reduce motion" get a calm version of every chapter.
