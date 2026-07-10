import { CHAT_MAX_MESSAGE_CHARS, CHAT_SYSTEM_PROMPT, GROQ_API_URL, GROQ_MODEL } from "./constants";
import type { ChatRole } from "./types";

type GroqMessage = { role: "system" | ChatRole; content: string };

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export async function completeChatWithGroq(
  messages: Array<{ role: ChatRole; content: string }>,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("חסר GROQ_API_KEY בשרת");
  }

  const payload = {
    model: GROQ_MODEL,
    temperature: 0.6,
    max_tokens: 1024,
    messages: [
      { role: "system", content: CHAT_SYSTEM_PROMPT },
      ...messages.map(
        (message): GroqMessage => ({
          role: message.role,
          content: message.content.slice(0, CHAT_MAX_MESSAGE_CHARS),
        }),
      ),
    ] satisfies GroqMessage[],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await response.text();
    let data: {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    } = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`תשובה לא תקינה מ-Groq (${response.status})`);
    }

    if (!response.ok) {
      const detail = data.error?.message || text.slice(0, 200) || `HTTP ${response.status}`;
      throw new Error(detail);
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("Groq החזיר תשובה ריקה");
    }

    return content;
  } finally {
    clearTimeout(timer);
  }
}
