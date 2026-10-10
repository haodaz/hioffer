"""Fetch a public web page as readable text plus its links."""
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from ..llm import Tool

HEADERS = {"User-Agent": "Mozilla/5.0 (hioffer research agent; contact via repo)"}
MAX_CHARS = 14000


def fetch_page(url: str, max_chars: int = MAX_CHARS) -> dict:
    r = httpx.get(url, headers=HEADERS, follow_redirects=True, timeout=30)
    r.raise_for_status()
    ctype = r.headers.get("content-type", "")
    if "pdf" in ctype:
        from .files import pdf_text
        return {"url": str(r.url), "title": url, "text": pdf_text(r.content)[:max_chars], "links": []}
    soup = BeautifulSoup(r.text, "lxml")
    for t in soup(["script", "style", "noscript", "svg"]):
        t.decompose()
    title = soup.title.get_text(strip=True) if soup.title else url
    main = soup.find("main") or soup.body or soup
    lines = [ln.strip() for ln in main.get_text("\n").splitlines()]
    text = "\n".join(ln for ln in lines if ln)
    links = []
    seen = set()
    for a in main.find_all("a", href=True):
        label = a.get_text(" ", strip=True)
        href = urljoin(str(r.url), a["href"]).split("#")[0]
        if not label or href in seen or not href.startswith("http"):
            continue
        seen.add(href)
        links.append({"text": label[:80], "url": href})
    truncated = len(text) > max_chars
    return {
        "url": str(r.url),
        "title": title,
        "text": text[:max_chars],
        "truncated": truncated,
        "links": links[:150],
    }


FETCH_PAGE = Tool(
    name="fetch_page",
    description="Fetch a public web page and return its readable text and links. Use it to read official "
    "program pages and follow links to requirement, deadline, FAQ or faculty pages.",
    parameters={
        "type": "object",
        "properties": {"url": {"type": "string", "description": "Absolute http(s) URL"}},
        "required": ["url"],
    },
    fn=fetch_page,
)
