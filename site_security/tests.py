"""Automatic checks for the site's safety features and pages.

Run with:  python manage.py test
"""
import re

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings

from site_security.security_settings import read_secret_key

PAGE_PARTS = [
    'id="memory-flood"', 'id="memory-background"', 'id="night-sky"', 'id="watching-eyes"', 'id="scroll"',
    'id="golden-winged-ball"', 'id="swirling-portal"', 'id="lightning-flash"',
    'id="drawing-line"', 'id="enchanted-clock"', "vendor/oneko.js",
]


class TheMagicPage(SimpleTestCase):
    def test_page_shows_every_part(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        for part in PAGE_PARTS:
            self.assertContains(response, part)

    def test_the_letter_is_in_the_scroll(self):
        # The wording lives in letter.html and may change; check its structure, not its words.
        page = self.client.get("/").content.decode()
        self.assertIn('id="letter"', page)
        self.assertIn('class="eyebrow"', page)
        self.assertGreaterEqual(page.count('class="letter-paragraph'), 1)

    def test_fonts_may_only_come_from_this_site(self):
        header = self.client.get("/").headers["Content-Security-Policy"]
        self.assertIn("font-src 'self'", header)

    def test_no_template_comments_leak_onto_the_page(self):
        page = self.client.get("/").content.decode()
        for leftover in ["{#", "#}", "{%", "%}"]:
            self.assertNotIn(leftover, page)

    def test_every_script_carries_the_same_one_time_code_as_the_security_header(self):
        response = self.client.get("/")
        header = response.headers["Content-Security-Policy"]
        nonce = header.split("'nonce-")[1].split("'")[0]
        script_tags = re.findall(r"<script[^>]*>", response.content.decode())
        self.assertGreater(len(script_tags), 10)
        for tag in script_tags:
            self.assertIn(f'nonce="{nonce}"', tag)
        self.assertIn("default-src 'none'", header)
        self.assertIn("frame-ancestors 'none'", header)

    def test_the_code_changes_on_every_visit(self):
        first = self.client.get("/").headers["Content-Security-Policy"]
        second = self.client.get("/").headers["Content-Security-Policy"]
        self.assertNotEqual(first, second)

    def test_other_sites_may_not_frame_the_page(self):
        self.assertEqual(self.client.get("/").headers["X-Frame-Options"], "DENY")

    def test_health_check_says_ok(self):
        response = self.client.get("/healthz")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"ok")

    def test_unknown_addresses_are_not_found(self):
        self.assertEqual(self.client.get("/admin/").status_code, 404)


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
