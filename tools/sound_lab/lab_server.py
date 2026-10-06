"""The sound lab's helper: serves the project folder so the lab can use the site's own code, lists the
recordings in the sound orchestra's audio folder, and saves recordings you upload from the lab there.

    python3 tools/sound_lab/lab_server.py            then open http://localhost:8004/tools/sound_lab/sound_lab.html
    python3 tools/sound_lab/lab_server.py 8005       (another port)

For your computer only (it listens on this computer alone; in compose.dev.yaml the port is likewise
only open to this computer). Only standard Python.

What it answers besides plain files:
    GET  /lab/recordings          the recordings in chapters/shared/sound_orchestra/audio/, as JSON
    POST /lab/upload?name=X.ogg   saves the request's body as that recording (a safe name, an audio type,
                                  at most MAX_UPLOAD_MB); an existing file of that name is replaced
"""
import json
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

PROJECT = Path(__file__).resolve().parents[2]
RECORDINGS = PROJECT / "chapters" / "shared" / "sound_orchestra" / "audio"
AUDIO_TYPES = {".ogg", ".oga", ".opus", ".mp3", ".wav", ".m4a", ".aac", ".flac", ".webm"}
MAX_UPLOAD_MB = 40
SAFE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$")


def safe_recording_name(name):
    """The name to save an upload as, or None if it isn't a plain, safe audio file name."""
    name = Path(name or "").name                      # never a folder, never "../"
    if not SAFE_NAME.match(name) or Path(name).suffix.lower() not in AUDIO_TYPES:
        return None
    return name


def recordings():
    RECORDINGS.mkdir(exist_ok=True)
    return sorted(f.name for f in RECORDINGS.iterdir() if f.is_file() and f.suffix.lower() in AUDIO_TYPES)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT), **kwargs)

    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")   # always the newest version of every file
        super().end_headers()

    def answer(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if urlparse(self.path).path == "/lab/recordings":
            return self.answer(200, recordings())
        return super().do_GET()

    def do_POST(self):
        address = urlparse(self.path)
        if address.path != "/lab/upload":
            return self.answer(404, {"error": "not here"})
        name = safe_recording_name(parse_qs(address.query).get("name", [""])[0])
        if not name:
            return self.answer(400, {"error": f"use a simple file name ending in one of {sorted(AUDIO_TYPES)}"})
        size = int(self.headers.get("Content-Length") or 0)
        if not size or size > MAX_UPLOAD_MB * 1024 * 1024:
            return self.answer(413, {"error": f"empty, or bigger than {MAX_UPLOAD_MB} MB"})
        RECORDINGS.mkdir(exist_ok=True)
        (RECORDINGS / name).write_bytes(self.rfile.read(size))
        print(f"saved audio/{name}", flush=True)
        return self.answer(200, {"saved": name, "file": f"audio/{name}"})


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 8004
    host = "0.0.0.0" if "--in-docker" in sys.argv else "127.0.0.1"
    print(f"Sound lab: http://localhost:{port}/tools/sound_lab/sound_lab.html  (Ctrl+C to stop)", flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()
