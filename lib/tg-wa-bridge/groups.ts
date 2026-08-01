import {
  bridgeWhatsAppGroupName,
  normalizeGroupName,
} from "./channels";

export type WhatsAppGroup = {
  id: string;
  name: string;
};

function greenApiInstance(): string {
  return (process.env.GREEN_API_INSTANCE ?? "").trim();
}

function greenApiToken(): string {
  return (process.env.GREEN_API_TOKEN ?? "").trim();
}

export async function listWhatsAppGroups(): Promise<{
  ok: boolean;
  groups: WhatsAppGroup[];
  error?: string;
}> {
  const instance = greenApiInstance();
  const token = greenApiToken();
  if (!instance || !token) {
    return {
      ok: false,
      groups: [],
      error: "חסר GREEN_API_INSTANCE / GREEN_API_TOKEN",
    };
  }

  const response = await fetch(
    `https://api.green-api.com/waInstance${instance}/getChats/${token}`,
    { cache: "no-store" },
  );
  const body = (await response.json().catch(() => null)) as
    | { id?: string; name?: string }[]
    | { message?: string }
    | null;

  if (!response.ok) {
    return {
      ok: false,
      groups: [],
      error: `Green API getChats HTTP ${response.status}`,
    };
  }

  const chats = Array.isArray(body) ? body : [];
  const groups = chats
    .filter((chat) => String(chat.id ?? "").endsWith("@g.us"))
    .map((chat) => ({
      id: String(chat.id),
      name: String(chat.name ?? ""),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  return { ok: true, groups };
}

export function findPreferredGroup(
  groups: WhatsAppGroup[],
  preferredName = bridgeWhatsAppGroupName(),
): WhatsAppGroup | null {
  const target = normalizeGroupName(preferredName);
  const core = normalizeGroupName("דיווחים מבצעי איראן");

  return (
    groups.find((g) => normalizeGroupName(g.name) === target) ??
    groups.find((g) => normalizeGroupName(g.name).includes(core)) ??
    groups.find((g) => normalizeGroupName(g.name).includes(target)) ??
    null
  );
}
