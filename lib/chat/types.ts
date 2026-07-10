export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type ChatRequestBody = {
  messages: Array<{ role: ChatRole; content: string }>;
};

export type ChatResponseBody = {
  ok: boolean;
  message?: ChatMessage;
  error?: string;
};
