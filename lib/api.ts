import {
  getBotGroupStandings,
  getBotLatestNews,
  getBotLiveMatches,
  getBotStatCards,
  getBotTopScorers,
  getBotTournament,
} from "./python-bridge";

export async function getLiveMatches() {
  return getBotLiveMatches();
}

export async function getGroupStandings() {
  return getBotGroupStandings();
}

export async function getTopScorers() {
  return getBotTopScorers();
}

export async function getLatestNews() {
  return getBotLatestNews();
}

export async function getStatCards() {
  return getBotStatCards();
}

export async function getTournament() {
  return getBotTournament();
}
