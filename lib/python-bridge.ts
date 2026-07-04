import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { unstable_cache } from "next/cache";
import { FOOTBALL_BOT_PATH, LIVE_DATA_REVALIDATE_SECONDS } from "./constants";
import type {
  GroupStandingView,
  LiveMatchView,
  NewsView,
  ScorerView,
  StatCardView,
} from "./types";

const execFileAsync = promisify(execFile);

export type BotResource =
  | "live_matches"
  | "group_standings"
  | "top_scorers"
  | "latest_news"
  | "stat_cards"
  | "tournament";

function resolveBotPath(): string {
  return FOOTBALL_BOT_PATH || join(homedir(), "fifa-whatsapp-bot");
}

function resolvePythonPath(botPath: string): string {
  if (process.env.PYTHON_PATH) {
    return process.env.PYTHON_PATH;
  }

  const venvPython = join(botPath, ".venv", "bin", "python3");
  if (existsSync(venvPython)) {
    return venvPython;
  }

  return "python3";
}

async function fetchBotResource<T>(resource: BotResource): Promise<T> {
  const botPath = resolveBotPath();
  const pythonPath = resolvePythonPath(botPath);
  const scriptPath = join(process.cwd(), "scripts", "fifa_website_bridge.py");

  const { stdout } = await execFileAsync(
    pythonPath,
    [scriptPath, resource],
    {
      env: {
        ...process.env,
        FOOTBALL_BOT_PATH: botPath,
      },
      maxBuffer: 16 * 1024 * 1024,
      timeout: 120_000,
    },
  );

  return JSON.parse(stdout) as T;
}

function cachedBotFetch<T>(resource: BotResource) {
  return unstable_cache(
    () => fetchBotResource<T>(resource),
    ["fifa-bot", resource],
    { revalidate: LIVE_DATA_REVALIDATE_SECONDS },
  )();
}

export function getBotLiveMatches(): Promise<LiveMatchView[]> {
  return cachedBotFetch<LiveMatchView[]>("live_matches");
}

export function getBotGroupStandings(): Promise<GroupStandingView[]> {
  return cachedBotFetch<GroupStandingView[]>("group_standings");
}

export function getBotTopScorers(): Promise<ScorerView[]> {
  return cachedBotFetch<ScorerView[]>("top_scorers");
}

export function getBotLatestNews(): Promise<NewsView[]> {
  return cachedBotFetch<NewsView[]>("latest_news");
}

export function getBotStatCards(): Promise<StatCardView[]> {
  return cachedBotFetch<StatCardView[]>("stat_cards");
}

export function getBotTournament(): Promise<{
  totalTeams: number;
  totalMatches: number;
  totalCities: number;
  images: { stadium: string; trophy: string };
}> {
  return cachedBotFetch("tournament");
}
