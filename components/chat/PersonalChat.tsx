"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ChatMessage } from "@/lib/chat/types";

const STORAGE_KEY = "personal-chat-session-v1";
const PASSWORD_KEY = "personal-chat-password-v1";

type StoredSession = {
  messages: ChatMessage[];
};

function loadSession(): StoredSession {
  if (typeof window === "undefined") return { messages: [] };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [] };
    const parsed = JSON.parse(raw) as StoredSession;
    if (!Array.isArray(parsed.messages)) return { messages: [] };
    return { messages: parsed.messages };
  } catch {
    return { messages: [] };
  }
}

function saveSession(messages: ChatMessage[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages }));
}

function makeUserMessage(content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  };
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function PersonalChat() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const verifyPassword = useCallback(
    async (candidate: string, existingMessages: ChatMessage[], silent = false) => {
      const response = await fetch("/api/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: candidate }),
      });
      if (!response.ok) {
        if (!silent) setError("סיסמה שגויה");
        else setError("הסיסמה השמורה לא תקפה — הזן שוב");
        sessionStorage.removeItem(PASSWORD_KEY);
        setUnlocked(false);
        return false;
      }
      sessionStorage.setItem(PASSWORD_KEY, candidate);
      setMessages(existingMessages);
      setUnlocked(true);
      setError(null);
      return true;
    },
    [],
  );

  useEffect(() => {
    const savedPassword = sessionStorage.getItem(PASSWORD_KEY);
    const session = loadSession();
    setMessages(session.messages);
    if (savedPassword) {
      setPassword(savedPassword);
      void verifyPassword(savedPassword, session.messages, true);
    }
    void fetch("/api/chat")
      .then((response) => response.json())
      .then((data: { configured?: boolean }) => setConfigured(Boolean(data.configured)))
      .catch(() => setConfigured(false));
  }, [verifyPassword]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleUnlock = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const ok = await verifyPassword(password.trim(), messages);
    if (!ok && !password.trim()) setError("הזן סיסמה");
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading || !unlocked) return;

    const userMessage = makeUserMessage(text);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    saveSession(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-chat-password": password,
        },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        message?: ChatMessage;
        error?: string;
      };

      if (!response.ok || !data.ok || !data.message) {
        if (response.status === 401) {
          setUnlocked(false);
          sessionStorage.removeItem(PASSWORD_KEY);
        }
        throw new Error(data.error || "שגיאה בשליחה");
      }

      const withAssistant = [...nextMessages, data.message];
      setMessages(withAssistant);
      saveSession(withAssistant);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const clearChat = () => {
    setMessages([]);
    saveSession([]);
    setError(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  if (configured === false) {
    return (
      <div dir="rtl" className="chat-page flex min-h-screen items-center justify-center p-6">
        <div className="chat-panel max-w-md rounded-2xl p-8 text-center">
          <p className="text-4xl">🔧</p>
          <h1 className="mt-4 text-xl font-black text-white">הצ&apos;אט לא מוגדר</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            הוסף ל-<code className="text-slate-300">.env.local</code>:
            <br />
            <span className="text-slate-300">CHAT_PASSWORD</span> ו-
            <span className="text-slate-300">GROQ_API_KEY</span>
            <br />
            (מפתח חינמי מ-console.groq.com)
          </p>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div dir="rtl" className="chat-page flex min-h-screen items-center justify-center p-6">
        <form onSubmit={handleUnlock} className="chat-panel w-full max-w-md rounded-2xl p-8">
          <p className="text-center text-4xl">🔒</p>
          <h1 className="mt-4 text-center text-2xl font-black text-white">הצ&apos;אט שלי</h1>
          <p className="mt-2 text-center text-sm text-slate-400">אישי · מוגן בסיסמה</p>
          <p className="mt-1 text-center text-[11px] text-slate-500">
            סיסמה: <span className="font-mono text-slate-300">david2026</span>
          </p>
          <label className="mt-8 block text-sm font-bold text-slate-400">סיסמה</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-sky-500/50"
            autoFocus
          />
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            className="mt-6 w-full rounded-xl bg-sky-600 py-3 text-sm font-black text-white transition hover:bg-sky-500"
          >
            כניסה
          </button>
        </form>
      </div>
    );
  }

  return (
    <div dir="rtl" className="chat-page flex min-h-screen flex-col">
      <header className="chat-header border-b border-white/10 px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-black text-white">הצ&apos;אט שלי</h1>
            <p className="text-xs text-slate-500">Groq · חינם · אישי</p>
          </div>
          <button
            type="button"
            onClick={clearChat}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-400 hover:text-white"
          >
            שיחה חדשה
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 md:px-6">
        <div className="flex-1 space-y-4 overflow-y-auto pb-4">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
              <p className="text-3xl">💬</p>
              <p className="mt-4 text-sm text-slate-400">שאל כל שאלה — אני כאן.</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-sky-600/20 border border-sky-500/20 text-sky-50"
                      : "chat-assistant-bubble text-slate-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                  <p className="mt-2 text-[10px] opacity-50">{formatTime(message.createdAt)}</p>
                </div>
              </div>
            ))
          )}
          {loading ? (
            <div className="flex justify-end">
              <div className="chat-assistant-bubble rounded-2xl px-4 py-3 text-sm text-slate-400">
                חושב...
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {error ? (
          <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <div className="chat-composer rounded-2xl border border-white/10 p-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="כתוב הודעה..."
            className="w-full resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[10px] text-slate-600">Enter לשליחה · Shift+Enter לשורה חדשה</p>
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={loading || !input.trim()}
              className="rounded-xl bg-sky-600 px-5 py-2 text-sm font-black text-white transition hover:bg-sky-500 disabled:opacity-40"
            >
              שלח
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
