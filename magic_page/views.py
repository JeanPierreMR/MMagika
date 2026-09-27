"""The two things the site can show."""
from django.http import HttpResponse
from django.shortcuts import render


def show_magic_page(request):
    """The whole magic page. It is built from the parts listed in magic_page/page.html."""
    return render(request, "page.html")


def show_health_check(request):
    """Render calls this every few seconds. Answering "ok" means "I'm alive"."""
    return HttpResponse("ok", content_type="text/plain")
