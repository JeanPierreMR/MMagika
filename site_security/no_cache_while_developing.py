"""
On your computer only (debug mode): tells the browser never to keep a copy of anything (pages, scripts,
styles, sounds), so every change you save shows up on a normal reload — no hard refresh, no restart.

What starts it:   every request passes through it (see MIDDLEWARE in settings.py).
What it does:     in debug mode, adds "Cache-Control: no-store" to every answer. On the real site (not
                  debug) it does nothing, so visitors' browsers still keep files and load fast.
"""

from django.conf import settings


class NoCacheWhileDeveloping:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if settings.DEBUG:
            response["Cache-Control"] = "no-store"
        return response
