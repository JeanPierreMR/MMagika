"""Automatic checks for the site's safety features and pages.

Run with:  python manage.py test
"""
import re

from django.core.exceptions import ImproperlyConfigured
from django.test import Client, SimpleTestCase, override_settings

from site_security.limit_vault_guesses import forget_all_guesses
from site_security.security_settings import read_secret_key, read_vault_combination

CHAPTER_PAGES = ["/vault", "/signal", "/terminal", "/letter"]
RIGHT_COMBINATION = {"combination": "12MD20262020"}   # the default on your computer (security_settings.py)


def open_the_vault(client):
    return client.post("/vault/open", RIGHT_COMBINATION, content_type="application/json")


def finish_every_chapter(client):
    open_the_vault(client)
    client.post("/signal/done")
    client.post("/terminal/done")


class StartsFresh(SimpleTestCase):
    """Each test starts with no vault guesses counted (they're counted per visitor address)."""
    def setUp(self):
        forget_all_guesses()


class TheStory(StartsFresh):
    def test_the_front_door_sends_a_new_visitor_to_the_vault(self):
        self.assertRedirects(self.client.get("/"), "/vault", fetch_redirect_response=False)

    def test_later_chapters_stay_locked_until_the_earlier_ones_are_finished(self):
        for page in ["/signal", "/terminal", "/letter"]:
            self.assertRedirects(self.client.get(page), "/vault", fetch_redirect_response=False)

    def test_a_wrong_combination_keeps_the_vault_shut(self):
        answer = self.client.post("/vault/open", {"combination": "000000000000"}, content_type="application/json")
        self.assertEqual(answer.json(), {"opened": False})
        self.assertRedirects(self.client.get("/signal"), "/vault", fetch_redirect_response=False)

    def test_the_right_combination_opens_the_signal(self):
        self.assertEqual(open_the_vault(self.client).json(), {"opened": True, "next": "/signal"})
        self.assertEqual(self.client.get("/signal").status_code, 200)

    def test_the_combination_never_appears_in_the_page(self):
        self.assertNotContains(self.client.get("/vault"), "12MD20262020")

    def test_each_chapter_leads_to_the_next(self):
        open_the_vault(self.client)
        self.assertEqual(self.client.post("/signal/done").json(), {"next": "/terminal"})
        self.assertEqual(self.client.post("/terminal/done").json(), {"next": "/letter"})
        self.assertEqual(self.client.get("/letter").status_code, 200)
        self.assertRedirects(self.client.get("/"), "/letter", fetch_redirect_response=False)

    def test_a_chapter_cant_be_finished_before_it_is_open(self):
        self.assertEqual(self.client.post("/terminal/done").status_code, 403)

    @override_settings(DEBUG=True)
    def test_on_your_computer_skip_jumps_to_any_chapter(self):
        self.assertEqual(self.client.get("/letter?skip").status_code, 200)

    def test_skip_does_nothing_on_the_real_site(self):
        self.assertRedirects(self.client.get("/letter?skip"), "/vault", fetch_redirect_response=False)

    def test_the_letter_is_in_the_scroll(self):
        finish_every_chapter(self.client)
        page = self.client.get("/letter").content.decode()
        for part in ['id="letter"', 'id="scroll"', 'id="night-sky"', 'id="future-frame"', "letter_video_player.css"]:
            self.assertIn(part, page)
        self.assertGreaterEqual(page.count('class="letter-paragraph'), 1)

    def test_the_signal_waits_for_the_microphone_and_shows_the_picture(self):
        open_the_vault(self.client)
        page = self.client.get("/signal").content.decode()
        self.assertIn('id="turn-on-microphone"', page)
        self.assertIn("signal/images/mockingjay.png", page)
        self.assertNotIn("Can't use the microphone", page)       # no way round the microphone

    def test_the_terminal_begins_with_the_crash(self):
        open_the_vault(self.client)
        self.client.post("/signal/done")
        page = self.client.get("/terminal").content.decode()
        self.assertIn("Kernel panic - not syncing", page)
        self.assertNotIn("TOP SECRET", page)

    def test_the_old_spells_and_retired_parts_are_gone(self):
        finish_every_chapter(self.client)
        for page in CHAPTER_PAGES:
            content = self.client.get(page).content.decode()
            for retired in ["spellbook", "healing_spell", "pdollar", "wand", "enchanted-clock", "watching-eyes",
                            "golden-winged-ball", "memory-flood", "oneko", "letter_in_gold.js"]:
                self.assertNotIn(retired, content, f"{retired} still on {page}")

    @override_settings(DEBUG=True)
    def test_the_profiler_only_appears_on_your_own_computer(self):
        finish_every_chapter(self.client)
        self.assertContains(self.client.get("/letter?profile"), "profiler.js")
        self.assertNotContains(self.client.get("/letter"), "profiler.js")
        with override_settings(DEBUG=False):
            self.assertNotContains(self.client.get("/letter?profile"), "profiler.js")


class EveryChapterPage(StartsFresh):
    def setUp(self):
        super().setUp()
        finish_every_chapter(self.client)

    def test_fonts_may_only_come_from_this_site(self):
        for page in CHAPTER_PAGES:
            self.assertIn("font-src 'self'", self.client.get(page).headers["Content-Security-Policy"])

    def test_no_template_comments_leak_onto_the_page(self):
        for page in CHAPTER_PAGES:
            content = self.client.get(page).content.decode()
            for leftover in ["{#", "#}", "{%", "%}"]:
                self.assertNotIn(leftover, content, f"{leftover} on {page}")

    def test_every_script_carries_the_same_one_time_code_as_the_security_header(self):
        for page in CHAPTER_PAGES:
            response = self.client.get(page)
            header = response.headers["Content-Security-Policy"]
            nonce = header.split("'nonce-")[1].split("'")[0]
            for tag in re.findall(r"<(?:script|link)[^>]*>", response.content.decode()):
                if tag.startswith("<link") and 'rel="stylesheet"' not in tag:
                    continue
                self.assertIn(f'nonce="{nonce}"', tag, f"{tag} on {page}")
            self.assertIn("default-src 'none'", header)
            self.assertIn("frame-ancestors 'none'", header)

    def test_the_code_changes_on_every_visit(self):
        first = self.client.get("/letter").headers["Content-Security-Policy"]
        second = self.client.get("/letter").headers["Content-Security-Policy"]
        self.assertNotEqual(first, second)

    def test_other_sites_may_not_frame_the_page(self):
        self.assertEqual(self.client.get("/letter").headers["X-Frame-Options"], "DENY")

    def test_only_the_signal_may_use_the_microphone(self):
        for page in CHAPTER_PAGES:
            policy = self.client.get(page).headers["Permissions-Policy"]
            expected = "microphone=(self)" if page == "/signal" else "microphone=()"
            self.assertIn(expected, policy, page)
            self.assertIn("camera=()", policy)

    def test_health_check_says_ok(self):
        response = self.client.get("/healthz")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"ok")

    def test_unknown_addresses_are_not_found(self):
        self.assertEqual(self.client.get("/admin/").status_code, 404)


class GuardingTheVault(StartsFresh):
    def test_messages_without_the_pages_secret_token_are_refused(self):
        strict_client = Client(enforce_csrf_checks=True)
        answer = strict_client.post("/vault/open", RIGHT_COMBINATION, content_type="application/json")
        self.assertEqual(answer.status_code, 403)

    @override_settings(VAULT_GUESSES_ALLOWED_PER_VISITOR_PER_MINUTE=3)
    def test_too_many_guesses_jam_the_lock(self):
        wrong = {"combination": "AAAAAAAAAAAA"}
        answers = [self.client.post("/vault/open", wrong, content_type="application/json", REMOTE_ADDR="10.9.9.9").status_code
                   for _ in range(4)]
        self.assertEqual(answers, [200, 200, 200, 429])
        right_but_jammed = self.client.post("/vault/open", RIGHT_COMBINATION, content_type="application/json", REMOTE_ADDR="10.9.9.9")
        self.assertEqual(right_but_jammed.json()["jammed"], True)

    def test_production_refuses_to_start_without_a_combination(self):
        with self.assertRaises(ImproperlyConfigured):
            read_vault_combination({"RENDER": "true"})
        self.assertEqual(read_vault_combination({"RENDER": "true", "VAULT_COMBINATION": "abc123"}), "ABC123")


class LimitingRequests(SimpleTestCase):
    @override_settings(REQUESTS_ALLOWED_PER_VISITOR_PER_MINUTE=3)
    def test_a_visitor_who_asks_too_often_is_told_to_slow_down(self):
        answers = [self.client.get("/healthz", REMOTE_ADDR="10.0.0.1").status_code for _ in range(5)]
        self.assertEqual(answers, [200, 200, 200, 429, 429])

    @override_settings(REQUESTS_ALLOWED_PER_VISITOR_PER_MINUTE=3)
    def test_each_visitor_has_their_own_count(self):
        for _ in range(3):
            self.client.get("/healthz", REMOTE_ADDR="10.0.0.2")
        self.assertEqual(self.client.get("/healthz", REMOTE_ADDR="10.0.0.3").status_code, 200)

    @override_settings(REQUESTS_ALLOWED_PER_VISITOR_PER_MINUTE=2)
    def test_behind_renders_proxy_the_first_forwarded_address_is_the_visitor(self):
        for _ in range(2):
            self.client.get("/healthz", HTTP_X_FORWARDED_FOR="203.0.113.9, 10.1.1.1")
        blocked = self.client.get("/healthz", HTTP_X_FORWARDED_FOR="203.0.113.9, 10.1.1.1")
        other_visitor = self.client.get("/healthz", HTTP_X_FORWARDED_FOR="198.51.100.4, 10.1.1.1")
        self.assertEqual((blocked.status_code, other_visitor.status_code), (429, 200))
        self.assertIn("Retry-After", blocked.headers)


class TheSecretKey(SimpleTestCase):
    def test_production_refuses_to_start_without_a_secret_key(self):
        with self.assertRaises(ImproperlyConfigured):
            read_secret_key({"RENDER": "true"})
        with self.assertRaises(ImproperlyConfigured):
            read_secret_key({"DJANGO_PRODUCTION": "1"})

    def test_the_secret_key_comes_from_the_environment(self):
        self.assertEqual(read_secret_key({"RENDER": "true", "DJANGO_SECRET_KEY": "s3cret"}), "s3cret")

    def test_your_computer_gets_a_harmless_development_key(self):
        self.assertIn("never-use-in-production", read_secret_key({}))


class TheSoundBook(SimpleTestCase):
    """Every sound a chapter asks for exists in chapters/shared/sound_orchestra/sound_book.js."""
    def test_every_cue_used_by_a_chapter_is_in_the_sound_book(self):
        from pathlib import Path
        chapters = Path(__file__).resolve().parent.parent / "chapters"
        book = (chapters / "shared" / "sound_orchestra" / "sound_book.js").read_text()
        listed = set(re.findall(r'^\s*"([a-z]+\.[a-z_]+)":', book, re.MULTILINE))
        used = set()
        for script in chapters.rglob("*.js"):
            used |= set(re.findall(r'(?:cue|stopCue|duck)\("([a-z]+\.[a-z_]+)"', script.read_text()))
        self.assertTrue(used, "no cues found")
        self.assertEqual(used - listed, set(), "cues used but missing from sound_book.js")

    def test_every_synth_named_in_the_sound_book_exists(self):
        from pathlib import Path
        folder = Path(__file__).resolve().parent.parent / "chapters" / "shared" / "sound_orchestra"
        named = set(re.findall(r'synth: "(\w+)"', (folder / "sound_book.js").read_text()))
        made = set(re.findall(r"^export function (\w+)\(", (folder / "synth_recipes.js").read_text(), re.MULTILINE))
        self.assertEqual(named - made, set(), "synth recipes named in sound_book.js but missing")


class TheSoundLabUploads(SimpleTestCase):
    """The sound lab's helper (tools/sound_lab/lab_server.py) only saves plain audio file names."""
    def test_only_plain_audio_names_are_accepted(self):
        import importlib.util
        from pathlib import Path
        path = Path(__file__).resolve().parent.parent / "tools" / "sound_lab" / "lab_server.py"
        spec = importlib.util.spec_from_file_location("lab_server", path)
        lab_server = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(lab_server)
        self.assertEqual(lab_server.safe_recording_name("forest_dawn.ogg"), "forest_dawn.ogg")
        self.assertEqual(lab_server.safe_recording_name("../../site_settings/settings.py"), None)
        self.assertEqual(lab_server.safe_recording_name("../evil.mp3"), "evil.mp3")    # only the name is kept
        self.assertEqual(lab_server.safe_recording_name("notes.txt"), None)
        self.assertEqual(lab_server.safe_recording_name(".hidden.ogg"), None)
