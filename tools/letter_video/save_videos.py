"""Helper for pre-rendering the letter as videos (see README.md in this folder).

    python tools/letter_video/save_videos.py render     renders the whole letter, start to finish
    python tools/letter_video/save_videos.py            only serves the tuner (and a manual render)
    (add a port number at the end to use another port, e.g. ... render 8004)

Serves the project folder (read-only) on http://localhost:8003, so the tuner and render_letter.html
can load the fonts, letter.html and the colour animation. The render page sends every frame it paints
here; each video's frames go straight into ffmpeg, so nothing piles up on disk. Needs ffmpeg, and
Firefox or Chrome/Chromium for "render". Only standard Python.

"render" opens the render page in a browser without a window, writes the new videos into a separate
folder, and only when every video is done swaps it in for the old one. So if it fails or you stop it
(Ctrl+C), the site keeps the videos it had.
"""
import json
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[2]
VIDEOS = PROJECT / "chapters" / "letter" / "scroll_and_wax_seal" / "letter_video"
NEW_VIDEOS = VIDEOS.with_name("letter_video_new")
RENDER_PAGE = "/tools/letter_video/render_letter.html"
output = VIDEOS          # where finished videos go: NEW_VIDEOS during "render"
encoders = {}            # video name -> the running ffmpeg
all_done = threading.Event()


def start_encoder(name, frames_per_second, size):
    # The page sends raw pixels (browsers slow down picture-making in background tabs; raw pixels
    # aren't slowed). H.264 in an .mp4 plays everywhere; "faststart" lets it begin before it has
    # fully downloaded.
    return subprocess.Popen([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgba", "-s", size, "-framerate", str(frames_per_second), "-i", "-",
        "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", str(output / f"{name}.mp4"),
    ], stdin=subprocess.PIPE)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT), **kwargs)

    def log_message(self, *args):
        pass

    def end_headers(self):
        # Never keep old copies: after editing a file, the tuner must see the new one.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        body = self.rfile.read(int(self.headers["Content-Length"]))
        parts = self.path.strip("/").split("/")
        if parts[0] == "frame":                     # /frame/<video name>/<frames per second>/<width>x<height>
            name, frames_per_second, size = parts[1], parts[2], parts[3]
            if name not in encoders:
                encoders[name] = start_encoder(name, frames_per_second, size)
            encoders[name].stdin.write(body)
        elif parts[0] == "finish":                  # /finish/<video name>
            encoder = encoders.pop(parts[1])
            encoder.stdin.close()
            encoder.wait()
            print(f"\nfinished {parts[1]}.mp4", flush=True)
        elif parts[0] == "progress":                # how far the render page has got
            print(f"\r{body.decode()[:110]:<110}", end="", flush=True)
        elif parts[0] == "settings":                # from the tuner: settings for the next render
            (Path(__file__).parent / "settings.json").write_text(json.dumps(json.loads(body), indent=1))
        elif parts[0] == "timing":                  # the timings the page needs, as JSON: the last thing sent
            (output / "timing.json").write_text(json.dumps(json.loads(body), indent=1))
            print("\nfinished timing.json: all done", flush=True)
            all_done.set()
        else:
            self.send_error(400)
            return
        self.send_response(204)
        self.end_headers()


def browser_command(url, profile):
    """A browser without a window, with its own empty profile (so it doesn't touch yours)."""
    for name in ["firefox", "/Applications/Firefox.app/Contents/MacOS/firefox"]:
        if shutil.which(name):
            return [shutil.which(name), "--headless", "--no-remote", "-profile", profile, url]
    for name in ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable",
                 "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]:
        if shutil.which(name):
            return [shutil.which(name), "--headless=new", f"--user-data-dir={profile}", "--autoplay-policy=no-user-gesture-required", url]
    sys.exit("Couldn't find Firefox or Chrome. Open the render page by hand instead (see README.md).")


def close(browser):
    try:
        browser.terminate()
        browser.wait(10)
    except (PermissionError, subprocess.TimeoutExpired):
        print(f"\nCouldn't close the render browser. Close it with:  pkill -f letter-render-profile", flush=True)


def render(port):
    global output
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is needed: install it first.")
    shutil.rmtree(NEW_VIDEOS, ignore_errors=True)
    NEW_VIDEOS.mkdir()
    output = NEW_VIDEOS
    # The browser's profile is a folder in your home folder, deleted at the end: Ubuntu's Firefox (a
    # snap) can't use one in /tmp, or a hidden one.
    with tempfile.TemporaryDirectory(prefix="letter-render-profile-", dir=Path.home()) as profile:
        browser = subprocess.Popen(browser_command(f"http://localhost:{port}{RENDER_PAGE}", profile),
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        began = time.time()
        print(f"Rendering the letter (this takes a while: each video is printed as it's finished).")
        try:
            while not all_done.wait(5):
                if browser.poll() is not None:
                    sys.exit("\nThe browser closed before the render finished. The old videos are untouched.")
        except KeyboardInterrupt:
            sys.exit("\nStopped. The old videos are untouched.")
        finally:
            close(browser)
    # Swap the new videos in for the old ones.
    shutil.rmtree(VIDEOS)
    NEW_VIDEOS.rename(VIDEOS)
    print(f"Done in {round((time.time() - began) / 60, 1)} minutes. Hard-refresh /letter to see it.")


if __name__ == "__main__":
    arguments = sys.argv[1:]
    rendering = "render" in arguments
    numbers = [a for a in arguments if a.isdigit()]
    port = int(numbers[0]) if numbers else 8003
    VIDEOS.mkdir(exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    if not rendering:
        print(f"Serving on http://localhost:{port} (tuner: /tools/letter_video/tuner.html). Ctrl+C to stop.")
        server.serve_forever()
    threading.Thread(target=server.serve_forever, daemon=True).start()
    render(port)
