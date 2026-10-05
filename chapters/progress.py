"""
HOW FAR A VISITOR HAS GOT — the story's chapters, in order, and which ones are finished.

The progress is kept in the visitor's session (a signed cookie, see site_security/security_settings.py),
so a visitor can't skip ahead by typing an address: each chapter only opens once the ones before
it are finished.
"""

from django.conf import settings

# The chapters, in the order they're told. Each one is also its address: /vault, /signal, ...
CHAPTERS = ["vault", "signal", "terminal", "letter"]


def finished_chapters(request):
    return set(request.session.get("finished_chapters", []))


def mark_finished(request, chapter):
    finished = finished_chapters(request) | {chapter}
    request.session["finished_chapters"] = [name for name in CHAPTERS if name in finished]


def may_open(request, chapter):
    """A chapter may open once every chapter before it is finished."""
    earlier = CHAPTERS[: CHAPTERS.index(chapter)]
    return set(earlier) <= finished_chapters(request)


def current_chapter(request):
    """The first chapter not finished yet (the letter, once everything else is done)."""
    finished = finished_chapters(request)
    for chapter in CHAPTERS:
        if chapter not in finished:
            return chapter
    return CHAPTERS[-1]


def next_chapter(chapter):
    position = CHAPTERS.index(chapter)
    return CHAPTERS[min(position + 1, len(CHAPTERS) - 1)]


def skip_to(request, chapter):
    """Only on your own computer (debug mode): ?skip marks every earlier chapter as finished."""
    if settings.DEBUG and "skip" in request.GET:
        for earlier in CHAPTERS[: CHAPTERS.index(chapter)]:
            mark_finished(request, earlier)
