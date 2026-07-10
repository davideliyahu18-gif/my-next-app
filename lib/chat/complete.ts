import type { ChatRole } from "./types";
import { completeChatWithGroq, isGroqConfigured } from "./groq";
import { completeChatWithOllama, isOllamaConfigured } from "./ollama";

export function hasChatProvider(): boolean {
  return isGroqConfigured() || isOllamaConfigured();
}

export function getChatProviderLabel(): string {
  if (isGroqConfigured()) return "Groq";
  if (isOllamaConfigured()) return "Ollama";
  return "לא מוגדר";
}

export async function completeChat(
  messages: Array<{ role: ChatRole; content: string }>,
): Promise<string> {
  if (isGroqConfigured()) {
    try {
      return await completeChatWithGroq(messages);
    } catch (error) {
      if (!isOllamaConfigured()) throw error;
    }
  }

  if (isOllamaConfigured()) {
    return completeChatWithOllama(messages);
  }

  throw new Error("חסר GROQ_API_KEY או Ollama מקומי");
}
