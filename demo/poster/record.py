"""Record the animated poster to a 1080x1440 mp4 (silent, loops cleanly at 24 s).

    uv run python demo/poster/record.py            # -> demo/out/poster.mp4 and poster.png
"""
import subprocess
import time
from pathlib import Path

import imageio_ffmpeg
from playwright.sync_api import sync_playwright

D = Path(__file__).parent
OUT = D.parent / "out"
OUT.mkdir(exist_ok=True)
F = imageio_ffmpeg.get_ffmpeg_exe()
SECONDS = 24

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1080, "height": 1440}, record_video_dir=str(OUT), record_video_size={"width": 1080, "height": 1440})
    page = ctx.new_page()
    page.goto(f"file://{D / 'index.html'}")
    page.wait_for_timeout(3600)
    page.screenshot(path=str(OUT / "poster.png"))
    page.wait_for_timeout(SECONDS * 1000 - 3000)
    ctx.close()
    b.close()
webm = sorted(OUT.glob("*.webm"), key=lambda q: q.stat().st_mtime)[-1]
subprocess.run([F, "-loglevel", "error", "-y", "-ss", "0.6", "-t", str(SECONDS), "-i", str(webm), "-vf", "fps=30,format=yuv420p",
                "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-movflags", "+faststart", str(OUT / "poster.mp4")], check=True)
webm.unlink()
print("saved", OUT / "poster.mp4")
