import { AMADEUS_BASE_URL, TOKEN_REFRESH_SKEW_MS } from "./constants";

declare global {
  var __amadeusToken: { value: string; expiresAt: number } | undefined;
}

export function isAmadeusConfigured(): boolean {
  return Boolean(process.env.AMADEUS_API_KEY && process.env.AMADEUS_API_SECRET);
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
};

export async function getAccessToken(): Promise<string> {
  if (!isAmadeusConfigured()) {
    throw new Error("AMADEUS_API_KEY / AMADEUS_API_SECRET not configured");
  }

  const cached = globalThis.__amadeusToken;
  if (cached && cached.expiresAt - TOKEN_REFRESH_SKEW_MS > Date.now()) {
    return cached.value;
  }

  const response = await fetch(`${AMADEUS_BASE_URL}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.AMADEUS_API_KEY!,
      client_secret: process.env.AMADEUS_API_SECRET!,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`amadeus auth HTTP ${response.status}`);
  }

  const data = (await response.json()) as TokenResponse;
  globalThis.__amadeusToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

export async function amadeusGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${AMADEUS_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`amadeus HTTP ${response.status}: ${body.slice(0, 300)}`);
  }

  return response.json() as Promise<T>;
}
