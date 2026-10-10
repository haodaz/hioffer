// Narration via DashScope qwen-tts (voice Cherry). Writes tts/<id>.wav and tts/durations.json.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const KEY = fs.readFileSync('/Users/aisandbox/Documents/zhiji-yida/.env.local', 'utf8').split('\n').find(l => l.startsWith('DASHSCOPE_API_KEY=')).split('=')[1].trim();
const F = process.env.FFMPEG;
const segs = JSON.parse(fs.readFileSync('narration.json', 'utf8'));
fs.mkdirSync('tts', { recursive: true });
const durOf = (f) => { try { execFileSync(F, ['-i', f], { stdio: 'pipe' }); } catch (e) { const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(e.stderr.toString()); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : 0; } return 0; };
const out = [];
for (const s of segs) {
  const f = `tts/${s.id}.wav`;
  if (!fs.existsSync(f)) {
    const r = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'qwen3-tts-flash', input: { text: s.text, voice: 'Cherry', language_type: 'English' } }) });
    const j = await r.json();
    const url = j.output?.audio?.url; if (!url) { console.log('fail', s.id, JSON.stringify(j).slice(0, 200)); continue; }
    fs.writeFileSync(f, Buffer.from(await (await fetch(url)).arrayBuffer()));
  }
  const dur = durOf(f); out.push({ id: s.id, dur }); console.log(s.id, dur.toFixed(2) + 's');
}
fs.writeFileSync('tts/durations.json', JSON.stringify(out));
console.log('total', out.reduce((a, b) => a + b.dur, 0).toFixed(1) + 's');
