// The API base is public by nature (the browser calls it). Env var first; otherwise the hosted demo
// API when the page itself is not served from localhost.
const HOSTED_API = "https://hioffer-production.up.railway.app";
export const API =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? HOSTED_API
    : "http://localhost:8000");
/** Session = invite code + applicant id, kept in the browser. No session: the app pages send you to /login. */
export type Session = { applicant: string; name: string; code: string };
const SKEY = "hioffer.session";
export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SKEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
export function setSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SKEY, JSON.stringify(s));
    else localStorage.removeItem(SKEY);
  } catch {}
}
function who(): { id: string; headers: Record<string, string> } {
  const s = getSession();
  return { id: s?.applicant ?? "priya", headers: { "content-type": "application/json", "X-Invite": s?.code ?? "" } };
}

export async function login(code: string): Promise<Session> {
  const r = await fetch(`${API}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
  if (!r.ok) throw new Error(r.status === 401 ? "unknown code" : `HTTP ${r.status}`);
  const s = (await r.json()) as Session;
  setSession(s);
  return s;
}

export async function createApplicant(body: { name: string; files: { name: string; content: string }[]; programs: Record<string, string>[] }): Promise<Session> {
  const r = await fetch(`${API}/api/applicants`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const s = (await r.json()) as Session;
  setSession(s);
  return s;
}

export type Card = { kind: string } & Record<string, unknown>;
export type Event =
  | { type: "delta"; text: string }
  | { type: "final"; text: string }
  | { type: "tool_start"; name: string; args: Record<string, unknown> }
  | { type: "tool_log"; text: string }
  | { type: "tool_end"; name: string }
  | { type: "card"; card: Card }
  | { type: "error"; message: string };

export async function getState() {
  const w = who();
  const r = await fetch(`${API}/api/applicants/${w.id}/state`, { cache: "no-store", headers: w.headers });
  if (!r.ok) throw new Error(`state ${r.status}`);
  return r.json();
}

export async function upsertTodo(todo: Record<string, unknown>) {
  const w = who();
  const r = await fetch(`${API}/api/applicants/${w.id}/todos`, {
    method: "POST",
    headers: w.headers,
    body: JSON.stringify(todo),
  });
  return r.json();
}

export async function addSignal(sig: Record<string, unknown>) {
  const w = who();
  const r = await fetch(`${API}/api/applicants/${w.id}/signals`, {
    method: "POST",
    headers: w.headers,
    body: JSON.stringify(sig),
  });
  return r.json();
}

/** POST a chat message and stream Server-Sent Events to `onEvent`. */
export async function chat(
  message: string,
  history: { role: string; content: string }[],
  lang: string,
  onEvent: (e: Event) => void,
) {
  const w = who();
  const r = await fetch(`${API}/api/applicants/${w.id}/chat`, {
    method: "POST",
    headers: w.headers,
    body: JSON.stringify({ message, history, lang }),
  });
  if (!r.ok || !r.body) {
    onEvent({ type: "error", message: `HTTP ${r.status}` });
    return;
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const data = chunk
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("\n");
      if (data) {
        try {
          onEvent(JSON.parse(data));
        } catch {}
      }
    }
  }
}

/** Fetch helper for applicant routes used by components (interview, places). */
export async function apiPost(path: string, body: unknown): Promise<Response> {
  const w = who();
  return fetch(`${API}/api/applicants/${w.id}${path}`, { method: "POST", headers: w.headers, body: JSON.stringify(body) });
}
