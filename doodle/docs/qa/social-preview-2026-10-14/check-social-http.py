"""Check rendered crawler metadata, approved image bytes and channel redirects."""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen, build_opener, HTTPRedirectHandler
import json
import sys

base = sys.argv[1].rstrip("/")
output = Path(sys.argv[2])
site = "https://doodle.samistudio.nl"
image = "/social/doodle-og-2026-10-14.png"
approved_hash = "3564fddf3ed091e8a3a219606a2776e329ff3fc5b5bdd05d4b234e64f4e82e93"
locales = ["en", "nl", "de", "fr", "es", "pt-br", "it", "ja", "ko", "ar"]
channels = ["x", "reddit", "pinterest", "instagram", "tiktok", "facebook", "linkedin", "threads", "bluesky"]
slugs = ["card-doodles", "lunchbox-notes", "journal-doodles"]

class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta = {}
        self.canonical = None
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta":
            key = attrs.get("property") or attrs.get("name")
            if key:
                self.meta.setdefault(key, []).append(attrs.get("content"))
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical = attrs.get("href")

def page_check(item):
    route, agent = item
    with urlopen(Request(base + route, headers={"User-Agent": agent}), timeout=30) as response:
        assert response.status == 200
        head = Head()
        head.feed(response.read().decode())
    for key, expected in {
        "og:image": site + image,
        "og:image:width": "1200",
        "og:image:height": "630",
        "og:image:type": "image/png",
        "twitter:card": "summary_large_image",
        "twitter:image": site + image,
    }.items():
        assert head.meta.get(key) == [expected], (route, agent, key, head.meta.get(key))
    assert len(head.meta.get("og:image:alt", [])) == 1
    assert head.meta["og:image:alt"] == head.meta.get("twitter:image:alt")
    assert head.canonical == site + route, (route, head.canonical)
    assert head.meta["og:url"] == [head.canonical]
    return {"path": route, "agent": agent, "canonical": head.canonical}

routes = []
for locale in locales:
    prefix = "" if locale == "en" else "/" + locale
    routes.extend([prefix or "/", prefix + "/doodle-ideas", prefix + "/blog", prefix + "/for-ai"])
    routes.extend(prefix + "/blog/" + slug for slug in slugs)
routes.extend("/" + page for page in ["privacy", "terms", "refund", "contact", "delete-account"])
checks = [(route, "Twitterbot/1.0") for route in routes]
for agent in ["facebookexternalhit/1.1", "LinkedInBot/1.0", "Slackbot-LinkExpanding 1.0", "Discordbot/2.0", "WhatsApp/2.0"]:
    checks.extend((route, agent) for route in ["/", "/nl", "/doodle-ideas", "/blog/card-doodles", "/privacy"])
with ThreadPoolExecutor(max_workers=6) as pool:
    pages = list(pool.map(page_check, checks))

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

redirects = []
opener = build_opener(NoRedirect())
for channel in channels:
    try:
        opener.open(Request(base + "/" + channel, headers={"User-Agent": "Twitterbot/1.0"}), timeout=20)
        raise AssertionError("Channel link did not redirect: " + channel)
    except HTTPError as response:
        assert response.code == 307, (channel, response.code)
        destination = response.headers["Location"]
        parsed = urlparse(destination)
        assert parsed.path == "/"
        assert not parsed.netloc or parsed.netloc == urlparse(base).netloc
        assert parse_qs(parsed.query) == {"utm_source": [channel], "utm_medium": ["organic_social"], "utm_campaign": ["doodle_web_launch"]}
        redirects.append({"path": "/" + channel, "status": response.code, "destination": destination})

# Attribution must not make a second canonical page.
with urlopen(Request(base + "/?utm_source=x&utm_medium=organic_social&utm_campaign=doodle_web_launch", headers={"User-Agent": "Twitterbot/1.0"}), timeout=20) as response:
    tracked = Head()
    tracked.feed(response.read().decode())
    assert tracked.canonical == site + "/"
with urlopen(base + image, timeout=20) as response:
    data = response.read()
    assert response.status == 200
    assert response.headers.get_content_type() == "image/png"
assert sha256(data).hexdigest() == approved_hash
result = {"base": base, "passed": True, "page_checks": pages, "redirects": redirects, "image_sha256": approved_hash, "approved_image_bytes": len(data)}
output.write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps({"passed": True, "page_checks": len(pages), "redirects": len(redirects), "approved_image_bytes": len(data), "hash_match": True}))
