"""
Stops one visitor from flooding the site with requests.

What starts it:   every request to the site passes through it (see MIDDLEWARE in settings.py).
What it uses:     the visitor's internet address (IP) and the limit
                  REQUESTS_ALLOWED_PER_VISITOR_PER_MINUTE from security_settings.py.
What it does:     counts each visitor's requests during the current minute.
What changes:     a small in-memory tally; it is wiped at the start of every minute.
If over the limit: the visitor gets "429 Too Many Requests" instead of the page,
                  until the next minute starts.

Two honest limits of this approach:
  1. The tally lives in the memory of ONE running copy of the site. The server
     runs 2 copies (gunicorn --workers 2), so a visitor can really send up to
     2 × the limit. Fine for one small server; with many servers, keep the
     tally in a shared store such as Redis instead.
  2. It still costs a little work to refuse each request. A real flood should be
     stopped before it reaches the site, with a rate-limit rule on your own
     Cloudflare account (see README).
"""

import logging
import threading
import time

from django.conf import settings
from django.http import HttpResponse

logger = logging.getLogger(__name__)


def find_visitor_ip_address(request):
    """Return the visitor's internet address.

    On Render, requests reach us through Render's proxy, so REMOTE_ADDR is the
    proxy, not the visitor. The proxy writes the visitor's address first in the
    X-Forwarded-For header, so we take the first entry. Check this after the
    first deploy (see README): if everyone gets the same address, limits would
    apply to all visitors together.
    """
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


class LimitRequestsPerVisitor:
    def __init__(self, get_response):
        self.get_response = get_response            # "the rest of the site", called when a request is allowed
        self.current_minute = None
        self.requests_this_minute = {}              # visitor address -> number of requests this minute
        # Several requests can arrive at the same moment (the server uses threads).
        # The lock makes them update the tally one at a time, so no count is lost.
        self.lock = threading.Lock()

    def __call__(self, request):
        visitor = find_visitor_ip_address(request)
        limit = settings.REQUESTS_ALLOWED_PER_VISITOR_PER_MINUTE

        with self.lock:
            minute_now = int(time.time() // 60)
            if minute_now != self.current_minute:   # a new minute: everyone starts from zero
                self.current_minute = minute_now
                self.requests_this_minute = {}
            count = self.requests_this_minute.get(visitor, 0) + 1
            self.requests_this_minute[visitor] = count

        if count > limit:
            if count == limit + 1:                  # log once per visitor per minute, not every refused request
                logger.warning("Too many requests from %s: over %s this minute", visitor, limit)
            seconds_until_next_minute = 60 - int(time.time() % 60)
            return HttpResponse(
                "Too many requests. Please slow down and try again in a minute.",
                status=429,
                content_type="text/plain",
                headers={"Retry-After": str(seconds_until_next_minute)},
            )
        return self.get_response(request)
