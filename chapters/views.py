"""The pages of the story, and the few things a page can tell the site ("the vault is open")."""

import hmac
import json

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST

from chapters import progress
from site_security.limit_vault_guesses import one_more_guess_allowed


def show_current_chapter(request):
    """The site's front door: sends the visitor to the chapter they're up to."""
    return redirect(f"/{progress.current_chapter(request)}")


def show_chapter(request, chapter):
    """One chapter's page, chapters/<chapter>/<chapter>.html, if the visitor has got that far."""
    progress.skip_to(request, chapter)
    if not progress.may_open(request, chapter):
        return redirect(f"/{progress.current_chapter(request)}")
    # "?profile" adds the profiler (shared/profiler), but only on your own computer (debug mode).
    profiling = settings.DEBUG and "profile" in request.GET
    return render(request, f"{chapter}/{chapter}.html", {"profiling": profiling, "next_chapter": progress.next_chapter(chapter)})


def show_vault(request):
    return show_chapter(request, "vault")


def show_signal(request):
    return show_chapter(request, "signal")


def show_terminal(request):
    return show_chapter(request, "terminal")


def show_letter(request):
    return show_chapter(request, "letter")


@require_POST
def try_vault_combination(request):
    """The vault's dials send their combination here. Only the site knows the right one."""
    if not one_more_guess_allowed(request):
        return JsonResponse({"opened": False, "jammed": True}, status=429)
    try:
        guess = str(json.loads(request.body).get("combination", "")).strip().upper()
    except (ValueError, AttributeError):
        guess = ""
    # compare_digest takes the same time however many characters are right, so timing gives nothing away.
    if hmac.compare_digest(guess.encode(), settings.VAULT_COMBINATION.encode()):
        progress.mark_finished(request, "vault")
        return JsonResponse({"opened": True, "next": "/signal"})
    return JsonResponse({"opened": False})


@require_POST
def finish_signal(request):
    """The signal chapter is over (the mockingjay answered, the console crashed)."""
    return finish(request, "signal")


@require_POST
def finish_terminal(request):
    """The terminal has finished its message."""
    return finish(request, "terminal")


def finish(request, chapter):
    if not progress.may_open(request, chapter):
        return JsonResponse({"next": f"/{progress.current_chapter(request)}"}, status=403)
    progress.mark_finished(request, chapter)
    return JsonResponse({"next": f"/{progress.next_chapter(chapter)}"})


def show_health_check(request):
    """Render calls this every few seconds. Answering "ok" means "I'm alive"."""
    return HttpResponse("ok", content_type="text/plain")
