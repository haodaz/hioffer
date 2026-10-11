"""Assemble the demo video: recorded app clips + evidence stills + narration + burned-in subtitles.

    uv run python demo/assemble.py

Inputs: demo/out/app.webm + beats.json (from record.py), demo/tts/*.wav + durations.json (from tts.mjs),
evidence screenshots, demo/out/entire-still.png. Output: demo/out/hioffer-demo.mp4 (1920x1080, <= 3 min).
Each narration segment owns one visual; the visual lasts exactly as long as the narration (+ a beat),
so the audio never has to be sped up and nothing on screen is claimed without being seen.
"""
import json
import re
import subprocess
from pathlib import Path

import imageio_ffmpeg

F = imageio_ffmpeg.get_ffmpeg_exe()
D = Path(__file__).parent
OUT = D / "out"
beats = {b["name"]: b["t"] for b in json.loads((OUT / "beats.json").read_text())}
TEMPO = 1.07  # narration played slightly faster than recorded; inaudible, keeps the cut under 3:00
dur = {d["id"]: d["dur"] / TEMPO for d in json.loads((D / "tts" / "durations.json").read_text())}
narr = {n["id"]: n["text"] for n in json.loads((D / "narration.json").read_text())}
EV = D.parent / "evidence"
PAD = 0.2  # silence after each narration before the next visual

# Each segment: narration id, source, and how to produce the visual for exactly `length` seconds.
# kind "clip": take the app recording from `start`, played at `speed` (>=1 compresses waiting time).
# kind "still": one image with a slow push-in (zoompan).
# A clip runs from one beat to the next; its playback speed is whatever makes it last exactly as long as
# the narration (static pages slow down harmlessly, waiting for the model speeds up).
segments = [
    ("01", {"kind": "clip", "start": beats["landing hero"], "end": beats["landing modules"]}),
    ("02", {"kind": "clip", "start": beats["landing modules"], "end": beats["login"] - 0.3}),
    ("03", {"kind": "clip", "start": beats["login"], "end": beats["ask advisors"]}),
    ("04", {"kind": "clip", "start": beats["ask advisors"], "end": beats["ask drafts"]}),
    ("05", {"kind": "clip", "start": beats["ask drafts"], "end": beats["timeline page"] - 0.3}),
    ("06", {"kind": "clip", "start": beats["timeline page"], "end": beats["interview start"] - 0.3}),
    ("07", {"kind": "clip", "start": beats["interview start"], "end": beats["offers page"] - 0.3}),
    ("08", {"kind": "stills", "images": [EV / "neatlogs/02-run5-trace-tree.jpg", EV / "neatlogs/05-run1-json-error-in-trace.jpg"]}),
    ("09", {"kind": "stills", "images": [EV / "neatlogs/04-execution-failed-flagged-spans.jpg"]}),
    ("10", {"kind": "stills", "images": [OUT / "entire-still.png"]}),
    ("11", {"kind": "stills", "images": [EV / "cfo-ai/03-financial-outlook-funding-gap.jpg", EV / "cfo-ai/01-assumptions-page.jpg"]}),
    ("12", {"kind": "clip", "start": beats["offers page"], "end": beats["end"]}),
]

parts: list[Path] = []
t_cursor = 0.0
starts: list[tuple[str, float]] = []
for nid, spec in segments:
    length = dur[nid] + PAD
    part = OUT / f"part_{nid}.mp4"
    if spec["kind"] == "clip":
        src = max(spec["end"] - spec["start"], 0.5)
        speed = src / length  # <1 slows down, >1 speeds up
        vf = f"setpts=PTS/{speed:.4f},scale=1920:1080:flags=lanczos,fps=30,format=yuv420p"
        cmd = [F, "-loglevel", "error", "-y", "-ss", f"{spec['start']:.2f}", "-t", f"{src:.2f}", "-i", str(OUT / "app.webm"),
               "-vf", vf, "-t", f"{length:.2f}", "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18", str(part)]
        subprocess.run(cmd, check=True)
        print(f"{nid}: clip {src:.1f}s -> {length:.1f}s (x{speed:.2f})")
    else:
        imgs = spec["images"]
        each = length / len(imgs)
        subparts = []
        for i, img in enumerate(imgs):
            sp = OUT / f"part_{nid}_{i}.mp4"
            frames = int(each * 30)
            # fit the image on a 1920x1080 canvas, then a slow push-in
            vf = (f"scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=#16181f,"
                  f"zoompan=z='min(zoom+0.0006,1.12)':d={frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30,format=yuv420p")
            subprocess.run([F, "-loglevel", "error", "-y", "-loop", "1", "-i", str(img), "-vf", vf, "-t", f"{each:.2f}", "-an",
                            "-c:v", "libx264", "-preset", "fast", "-crf", "18", str(sp)], check=True)
            subparts.append(sp)
        lst = OUT / f"list_{nid}.txt"
        lst.write_text("".join(f"file '{p.name}'\n" for p in subparts))
        subprocess.run([F, "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(part)], check=True)
    parts.append(part)
    starts.append((nid, t_cursor))
    t_cursor += length

# concat all visual parts
lst = OUT / "list_all.txt"
lst.write_text("".join(f"file '{p.name}'\n" for p in parts))
subprocess.run([F, "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(OUT / "video_only.mp4")], check=True)

# subtitles: split each narration into sentence cues proportional to characters
def ts(x: float) -> str:
    h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", ",")

def wrap(t: str, n: int = 58) -> str:
    words, lines, cur = t.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > n and cur:
            lines.append(cur); cur = w
        else:
            cur = (cur + " " + w).strip()
    if cur: lines.append(cur)
    if len(lines) <= 2: return "\n".join(lines)
    half = len(lines) // 2
    return " ".join(lines[:half]) + "\n" + " ".join(lines[half:])

cues, k = [], 1
for nid, s in starts:
    sents = [x.strip() for x in re.split(r"(?<=[.!?;:])\s+", narr[nid]) if x.strip()]
    merged: list[str] = []
    for x in sents:
        if merged and len(x) < 30: merged[-1] += " " + x
        else: merged.append(x)
    total = sum(len(x) for x in merged); t = s
    for x in merged:
        d = dur[nid] * len(x) / total
        cues.append(f"{k}\n{ts(t)} --> {ts(t + d - 0.05)}\n{wrap(x)}\n"); k += 1; t += d
(OUT / "subs.srt").write_text("\n".join(cues))

# mix narration onto the timeline and burn subtitles
inputs = ["-i", str(OUT / "video_only.mp4")]
fl, mix = [], ""
for i, (nid, s) in enumerate(starts):
    inputs += ["-i", str(D / "tts" / f"{nid}.wav")]
    fl.append(f"[{i + 1}:a]aresample=48000,atempo={TEMPO},adelay={int(s * 1000)}|{int(s * 1000)}[a{i}]"); mix += f"[a{i}]"
style = "FontName=Helvetica,FontSize=15,PrimaryColour=&H00FFFFFF,OutlineColour=&H66000000,BackColour=&H66000000,BorderStyle=4,Outline=0,Shadow=0,MarginV=22,Alignment=2"
fc = ";".join(fl) + f";{mix}amix=inputs={len(starts)}:normalize=0,alimiter=limit=0.9[aout];[0:v]subtitles={OUT / 'subs.srt'}:force_style='{style}'[vout]"
subprocess.run([F, "-loglevel", "error", "-y", *inputs, "-filter_complex", fc, "-map", "[vout]", "-map", "[aout]",
                "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-t", f"{t_cursor:.2f}",
                str(OUT / "hioffer-demo.mp4")], check=True)
print("segments:", [(n, round(s, 1)) for n, s in starts])
print("total length:", round(t_cursor, 1), "s")
