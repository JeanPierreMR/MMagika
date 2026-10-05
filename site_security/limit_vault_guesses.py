"""
Stops anyone from guessing the vault's combination by trying thousands of them.

What starts it:   chapters/views.py, each time someone tries a combination.
What it uses:     the visitor's internet address and VAULT_GUESSES_ALLOWED_PER_VISITOR_PER_MINUTE
                  from security_settings.py.
What it does:     counts each visitor's guesses during the current minute; once over the limit,
                  says the lock is jammed until the next minute.
What changes:     a small in-memory tally, wiped every minute. (Like the request limit, it lives
                  in each running copy of the site; see limit_requests_per_visitor.py.)
"""

import logging
import threading
import time

from django.conf import settings

from site_security.limit_requests_per_visitor import find_visitor_ip_address

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_current_minute = None
_guesses_this_minute = {}   # visitor address -> guesses this minute


def one_more_guess_allowed(request):
    """Count this guess. Return False if the visitor has used up this minute's guesses."""
    global _current_minute
    visitor = find_visitor_ip_address(request)
    with _lock:
        minute_now = int(time.time() // 60)
        if minute_now != _current_minute:
            _current_minute = minute_now
            _guesses_this_minute.clear()
        guesses = _guesses_this_minute[visitor] = _guesses_this_minute.get(visitor, 0) + 1
    limit = settings.VAULT_GUESSES_ALLOWED_PER_VISITOR_PER_MINUTE
    if guesses == limit + 1:                        # log once per visitor per minute
        logger.warning("Vault jammed for %s: over %s guesses this minute", visitor, limit)
    return guesses <= limit


def forget_all_guesses():
    """Start everyone's count again (used by the tests, so each test starts fresh)."""
    with _lock:
        _guesses_this_minute.clear()
