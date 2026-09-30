"""Helper for making the letter's colour animation (see README.md in this folder).

Serves render_frames.html on http://localhost:8002 and saves every frame the page sends
into the folder given on the command line. Only standard Python, nothing to install.

    python tools/colour_field/save_frames.py /path/to/frames
"""
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

HERE = Path(__file__).parent
FRAMES = Path(sys.argv[1])
FRAMES.mkdir(parents=True, exist_ok=True)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(HERE), **kwargs)

    def do_POST(self):
        # POST /frame/0001 with a PNG as the body.
        name = self.path.rsplit("/", 1)[-1]
        if not name.isdigit():
            self.send_error(400)
            return
        body = self.rfile.read(int(self.headers["Content-Length"]))
        (FRAMES / f"frame_{name}.png").write_bytes(body)
        self.send_response(204)
        self.end_headers()


HTTPServer(("127.0.0.1", 8002), Handler).serve_forever()
