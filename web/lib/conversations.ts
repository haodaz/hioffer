"use client";

import { useCallback, useEffect, useState } from "react";
import type { Card } from "./api";

export type Msg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; cards: Card[]; tools: string[]; pending?: boolean };

export type Conversation = { id: string; title: string; createdAt: string; messages: Msg[] };

const KEY = "hioffer.conversations";

function read(): Conversation[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
function write(list: Conversation[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  } catch {}
}

export function newConversation(): Conversation {
  return { id: `c${Date.now().toString(36)}`, title: "", createdAt: new Date().toISOString(), messages: [] };
}

/** Conversation list in localStorage (per browser; the agent's state itself lives on the server). */
export function useConversations() {
  const [list, setList] = useState<Conversation[]>([]);
  useEffect(() => setList(read()), []);
  const save = useCallback((c: Conversation) => {
    setList((prev) => {
      const title = c.title || c.messages.find((m) => m.role === "user")?.content.slice(0, 48) || "";
      const next = [{ ...c, title }, ...prev.filter((x) => x.id !== c.id)];
      write(next);
      return next;
    });
  }, []);
  const remove = useCallback((id: string) => {
    setList((prev) => {
      const next = prev.filter((x) => x.id !== id);
      write(next);
      return next;
    });
  }, []);
  return { list, save, remove };
}
