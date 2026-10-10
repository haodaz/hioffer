"""Record the product walkthrough with Playwright (clean frames, no debugging banner).

    uv run python demo/record.py http://localhost:3000 demo/out

Produces demo/out/app.webm (1600x900) plus the real timings of each beat in demo/out/beats.json,
so the narration can be placed on what actually happened on screen.
"""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

base = sys.argv[1].rstrip("/")
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
beats: list[dict] = []
t0 = time.time()


def beat(name: str) -> None:
    beats.append({"name": name, "t": round(time.time() - t0, 2)})
    print(f"{beats[-1]['t']:6.1f}s  {name}")


def wait_reply(page, timeout=90) -> None:
    """Wait until the assistant's last message has finished (the 'steps' summary appears)."""
    for _ in range(timeout):
        if page.locator("summary", has_text="steps").count() > 0:
            return
        time.sleep(1)


def smooth_scroll(page, total: int, step: int = 120, pause: float = 0.05) -> None:
    for _ in range(0, total, step):
        page.mouse.wheel(0, step)
        time.sleep(pause)


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1600, "height": 900}, record_video_dir=str(out), record_video_size={"width": 1600, "height": 900},
                        device_scale_factor=1)
    page = ctx.new_page()
    t0 = time.time()

    # 1. Landing
    page.goto(f"{base}/", wait_until="networkidle")
    beat("landing hero")
    time.sleep(3)
    smooth_scroll(page, 1500)
    beat("landing modules")
    time.sleep(2)
    smooth_scroll(page, 2600)
    time.sleep(1.5)

    # 2. App home brief
    page.goto(f"{base}/app", wait_until="networkidle")
    time.sleep(1)
    beat("app brief")
    time.sleep(5)

    # 3. Ask for advisors -> card pane
    page.get_by_role("button", name="Who are the best-fit advisors at UW?").first.click()
    beat("ask advisors")
    wait_reply(page)
    beat("advisors reply")
    time.sleep(6)
    pane = page.locator("aside").last
    pane.evaluate("el => el.querySelector('div.overflow-y-auto') && el.querySelector('div.overflow-y-auto').scrollBy({top: 380, behavior: 'smooth'})")
    time.sleep(3)

    # 4. Drafts
    page.get_by_role("button", name="Show my UW drafts").first.click()
    beat("ask drafts")
    wait_reply(page)
    beat("drafts reply")
    time.sleep(5)
    emails = page.get_by_role("button", name="Outreach email drafts").first
    if emails.count():
        emails.click()
        beat("emails tab")
        time.sleep(4)

    # 5. Timeline page
    page.goto(f"{base}/app/timeline", wait_until="networkidle")
    beat("timeline page")
    time.sleep(5)

    # 6. Offers page
    page.goto(f"{base}/app/offers", wait_until="networkidle")
    beat("offers page")
    time.sleep(5)

    beat("end")
    ctx.close()
    b.close()

(out / "beats.json").write_text(json.dumps(beats, indent=2))
vids = sorted(out.glob("*.webm"), key=lambda q: q.stat().st_mtime)
vids[-1].rename(out / "app.webm")
print("saved", out / "app.webm")
