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
    """Wait until one more assistant message has finished (one more 'steps' summary than before the question)."""
    before = page.locator("summary", has_text="steps").count()
    for _ in range(timeout):
        if page.locator("summary", has_text="steps").count() > before:
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

    # 1b. Login with the demo code
    page.goto(f"{base}/login", wait_until="networkidle")
    beat("login")
    time.sleep(1.5)
    page.get_by_role("button", name="Priya Raman").first.click()
    page.wait_for_url("**/app", timeout=15000)

    # 2. App home brief
    time.sleep(1)
    beat("app brief")
    time.sleep(5)

    # 3. Ask for advisors -> card pane
    n0 = page.locator("summary", has_text="steps").count()
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
    time.sleep(4)

    # 6. Programs as places + map
    page.goto(f"{base}/app/programs", wait_until="networkidle")
    beat("places")
    time.sleep(3)
    page.get_by_role("button", name="Map").click()
    beat("map")
    time.sleep(5)

    # 7. Mock interview (cached plan + prior answers; no mic in headless, so the question is read on screen)
    page.goto(f"{base}/app/interview", wait_until="networkidle")
    time.sleep(1)
    page.get_by_role("button", name="Start interview").click()
    beat("interview start")
    time.sleep(3)
    page.get_by_role("button", name="Skip").click(force=True)
    beat("interview question")
    time.sleep(6)

    # 8. Offers page
    page.goto(f"{base}/app/offers", wait_until="networkidle")
    beat("offers page")
    time.sleep(4)

    beat("end")
    ctx.close()
    b.close()

(out / "beats.json").write_text(json.dumps(beats, indent=2))
vids = sorted(out.glob("*.webm"), key=lambda q: q.stat().st_mtime)
vids[-1].rename(out / "app.webm")
print("saved", out / "app.webm")
