import { CHAT_MAX_MESSAGE_CHARS, CHAT_SYSTEM_PROMPT } from "./constants";
import type { ChatRole } from "./types";

const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";

export function getOllamaBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_URL).replace(/\/$/, "");
}

export function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL || "llama3.2";
}

export function isOllamaConfigured(): boolean {
  return Boolean(getOllamaBaseUrl());
}

export async function completeChatWithOllama(
  messages: Array<{ role: ChatRole; content: string }>,
): Promise<string> {
  const payload = {
    model: getOllamaModel(),
    stream: false,
    messages: [
      { role: "system", content: CHAT_SYSTEM_PROMPT },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content.slice(0, CHAT_MAX_MESSAGE_CHARS),
      })),
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await response.text();
    let data: { message?: { content?: string }; error?: string } = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`תשובה לא תקינה מ-Ollama (${response.status})`);
    }

    if (!response.ok) {
      throw new Error(data.error || text.slice(0, 200) || `Ollama HTTP ${response.status}`);
    }

    const content = data.message?.content?.trim();
    if (!content) {
      throw new Error("Ollama החזיר תשובה ריקה");
    }
    return content;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Ollama לא הגיב בזמן — ודא שהמודל רץ");
    }
    const message = error instanceof Error ? error.message : String(error);
    if (/fetch failed|ECONNREFUSED/i.test(message)) {
      throw new Error(
        "Ollama לא פעיל. הרץ: ollama serve && ollama pull llama3.2 — או הוסף GROQ_API_KEY",
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
