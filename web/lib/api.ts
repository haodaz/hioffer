export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const APPLICANT = process.env.NEXT_PUBLIC_APPLICANT ?? "priya";

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
  const r = await fetch(`${API}/api/applicants/${APPLICANT}/state`, { cache: "no-store" });
  if (!r.ok) throw new Error(`state ${r.status}`);
  return r.json();
}

export async function upsertTodo(todo: Record<string, unknown>) {
  const r = await fetch(`${API}/api/applicants/${APPLICANT}/todos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(todo),
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
  const r = await fetch(`${API}/api/applicants/${APPLICANT}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
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
