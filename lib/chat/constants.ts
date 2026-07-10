export const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export const CHAT_MAX_HISTORY = 24;

export const CHAT_MAX_MESSAGE_CHARS = 4000;

export const CHAT_SYSTEM_PROMPT =
  "אתה עוזר אישי ידידותי ומדויק. ענה בעברית ברורה אלא אם המשתמש ביקש שפה אחרת. " +
  "תשובות קצרות וממוקדות כשאפשר. אם אינך יודע — אמור זאת בכנות.";
