#!/usr/bin/env python3
"""
Website data bridge — exposes live FIFA data via football_api.py.
Does not modify bot logic; only imports and aggregates existing API helpers.
"""

from __future__ import annotations

import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

BOT_PATH = Path(os.environ.get("FOOTBALL_BOT_PATH", Path.home() / "fifa-whatsapp-bot")).resolve()
if str(BOT_PATH) not in sys.path:
    sys.path.insert(0, str(BOT_PATH))

if BOT_PATH.exists():
    os.chdir(BOT_PATH)

import config  # noqa: E402
import football_api as fa  # noqa: E402
from football_api import (  # noqa: E402
    FootballAPIError,
    Match,
    _localized_name,
    _parse_datetime,
    get_calendar_matches,
    get_live_matches_now,
    get_matches_by_ids,
    get_next_scheduled_kickoff_matches,
    is_placeholder_scorer,
    latest_match_minute_label,
)
from team_display import country_flag, hebrew_team_name  # noqa: E402

IMAGES = {
    "stadium": "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=2400&q=85",
    "trophy": "https://images.unsplash.com/photo-1574629810360-7efbc16732a0?w=800&q=90",
}


def _team_label(side: dict[str, Any]) -> tuple[str, str, str]:
    code = str(side.get("Abbreviation") or side.get("IdCountry") or "")
    english = _localized_name(side.get("TeamName"))
    if config.ENABLE_HEBREW_TEAM_NAMES:
        name = hebrew_team_name(code, english)
    else:
        name = english
    flag = country_flag(code) if config.ENABLE_TEAM_FLAGS else ""
    return name, flag, code


def _venue_from_row(row: dict[str, Any]) -> str:
    stadium = row.get("Stadium") or {}
    name = _localized_name(stadium.get("Name"))
    city = _localized_name(stadium.get("CityName"))
    if name and city:
        return f"{name}, {city}"
    return name or city or "—"


def _calendar_row_by_id() -> dict[str, dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    for day_offset in range(-30, 8):
        for row in get_calendar_matches(day_offset=day_offset):
            rows[str(row["IdMatch"])] = row
    return rows


def _match_stage_label(match: Match) -> str:
    if match.group:
        return match.group
    if match.stage:
        return match.stage
    return match.competition or "מונדיאל 2026"


def _live_minute(match: Match) -> str:
    if match.status == "SCHEDULED":
        return match.utc_date.astimezone().strftime("%H:%M")
    if match.status == "FINISHED":
        return "סיום"
    return latest_match_minute_label(match)


def _match_to_live_view(match: Match, venue: str = "—") -> dict[str, Any]:
    status = "live" if match.status in {"IN_PLAY", "PAUSE"} else "upcoming"
    return {
        "id": match.id,
        "home": match.home_team,
        "homeFlag": match.home_flag,
        "away": match.away_team,
        "awayFlag": match.away_flag,
        "homeScore": match.home_score,
        "awayScore": match.away_score,
        "minute": _live_minute(match),
        "status": status,
        "venue": venue,
        "league": _match_stage_label(match),
    }


def fetch_live_matches() -> list[dict[str, Any]]:
    rows = _calendar_row_by_id()
    live = get_live_matches_now()
    upcoming = get_next_scheduled_kickoff_matches()

    seen: set[str] = set()
    views: list[dict[str, Any]] = []

    for match in live:
        seen.add(match.id)
        venue = _venue_from_row(rows.get(match.id, {}))
        views.append(_match_to_live_view(match, venue))

    for match in upcoming:
        if match.id in seen:
            continue
        seen.add(match.id)
        venue = _venue_from_row(rows.get(match.id, {}))
        views.append(_match_to_live_view(match, venue))
        if len(views) >= 8:
            break

    return views[:8]


def _is_row_finished(row: dict[str, Any]) -> bool:
    home = row.get("HomeTeamScore")
    away = row.get("AwayTeamScore")
    if home is None or away is None:
        return False
    kickoff = _parse_datetime(row.get("Date"))
    if kickoff > datetime.now(timezone.utc):
        return False
    status = int(row.get("MatchStatus", -1))
    if status in {0}:
        return True
    return kickoff < datetime.now(timezone.utc) - timedelta(minutes=105)


def fetch_group_standings() -> list[dict[str, Any]]:
    tables: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)

    for day_offset in range(-30, 8):
        for row in get_calendar_matches(day_offset=day_offset):
            group = _localized_name(row.get("GroupName"))
            if not group:
                continue
            if not _is_row_finished(row):
                continue

            home_side = row.get("Home") or {}
            away_side = row.get("Away") or {}
            home_name, home_flag, home_code = _team_label(home_side)
            away_name, away_flag, away_code = _team_label(away_side)
            home_score = int(row["HomeTeamScore"])
            away_score = int(row["AwayTeamScore"])

            for name, flag, code in (
                (home_name, home_flag, home_code),
                (away_name, away_flag, away_code),
            ):
                if name not in tables[group]:
                    tables[group][name] = {
                        "name": name,
                        "flag": flag,
                        "played": 0,
                        "gd": 0,
                        "pts": 0,
                    }

            tables[group][home_name]["played"] += 1
            tables[group][away_name]["played"] += 1
            tables[group][home_name]["gd"] += home_score - away_score
            tables[group][away_name]["gd"] += away_score - home_score

            if home_score > away_score:
                tables[group][home_name]["pts"] += 3
            elif away_score > home_score:
                tables[group][away_name]["pts"] += 3
            else:
                tables[group][home_name]["pts"] += 1
                tables[group][away_name]["pts"] += 1

    groups = []
    for group, teams in sorted(tables.items(), key=lambda item: item[0]):
        sorted_teams = sorted(
            teams.values(),
            key=lambda team: (-team["pts"], -team["gd"], team["name"]),
        )
        groups.append({"group": group.replace("Group ", "").strip() or group, "teams": sorted_teams})
    return groups[:6]


def _player_photo(name: str) -> str:
    safe = re.sub(r"\s+", "+", name.strip())
    return f"https://ui-avatars.com/api/?name={safe}&background=d4af37&color=111&size=200&bold=true"


def fetch_top_scorers(limit: int = 10) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    candidate_ids: list[str] = []
    seen: set[str] = set()

    for day_offset in range(-30, 2):
        for row in get_calendar_matches(day_offset=day_offset):
            match_id = str(row["IdMatch"])
            if match_id in seen:
                continue
            kickoff = _parse_datetime(row.get("Date"))
            if kickoff > now and row.get("HomeTeamScore") is None:
                continue
            seen.add(match_id)
            candidate_ids.append(match_id)

    scorers: dict[str, dict[str, Any]] = {}
    matches = get_matches_by_ids(candidate_ids[:80])

    for match in matches:
        for goal in match.goals:
            if is_placeholder_scorer(goal.scorer):
                continue
            key = goal.scorer.strip().upper()
            team = goal.team_name or match.home_team
            team_code = match.home_team_code if goal.team_name == match.home_team else match.away_team_code
            flag = country_flag(team_code) if config.ENABLE_TEAM_FLAGS else ""

            current = scorers.get(key) or {
                "name": goal.scorer.strip(),
                "team": team,
                "flag": flag,
                "goals": 0,
                "assists": 0,
            }
            if team and not current["team"]:
                current["team"] = team
            if flag and not current["flag"]:
                current["flag"] = flag
            current["goals"] += 1
            scorers[key] = current

    ranked = sorted(scorers.values(), key=lambda item: (-item["goals"], item["name"]))
    result = []
    for index, scorer in enumerate(ranked[:limit], start=1):
        result.append(
            {
                "rank": index,
                "name": scorer["name"],
                "team": scorer["team"],
                "flag": scorer["flag"],
                "goals": scorer["goals"],
                "assists": scorer["assists"],
                "photo": _player_photo(scorer["name"]),
            }
        )
    return result


def fetch_latest_news(limit: int = 4) -> list[dict[str, Any]]:
    rows = _calendar_row_by_id()
    items: list[dict[str, Any]] = []

    live = get_live_matches_now()
    for match in live:
        for goal in reversed(match.goals[-3:]):
            if is_placeholder_scorer(goal.scorer):
                continue
            items.append(
                {
                    "id": f"goal-{match.id}-{goal.event_id or goal.minute}",
                    "title": f"⚽ שער! {goal.scorer} ({goal.minute}) — {match.home_team} {match.home_score}-{match.away_score} {match.away_team}",
                    "excerpt": f"{match.home_team} מול {match.away_team} · {_match_stage_label(match)}",
                    "image": IMAGES["stadium"],
                    "time": "עכשיו",
                    "category": "משחק חי",
                    "featured": False,
                    "sort": match.utc_date.timestamp(),
                }
            )

    finished: list[Match] = []
    for day_offset in range(-7, 1):
        for row in get_calendar_matches(day_offset=day_offset):
            if not _is_row_finished(row):
                continue
            try:
                finished.append(fa.get_match_by_id(str(row["IdMatch"])))
            except FootballAPIError:
                continue

    finished.sort(key=lambda item: item.utc_date, reverse=True)
    for match in finished[:6]:
        items.append(
            {
                "id": f"result-{match.id}",
                "title": f"תוצאה סופית: {match.home_team} {match.home_score}-{match.away_score} {match.away_team}",
                "excerpt": f"{_match_stage_label(match)} · {match.competition or 'מונדיאל 2026'}",
                "image": IMAGES["stadium"],
                "time": match.utc_date.astimezone().strftime("%d/%m %H:%M"),
                "category": "תוצאות",
                "featured": False,
                "sort": match.utc_date.timestamp(),
            }
        )

    if not items:
        return []

    items.sort(key=lambda item: item["sort"], reverse=True)
    trimmed = items[:limit]

    for index, item in enumerate(trimmed):
        item["featured"] = index == 0
        item.pop("sort", None)

    return trimmed


def fetch_stat_cards() -> list[dict[str, Any]]:
    total_goals = 0
    finished_count = 0
    live_count = 0
    teams: set[str] = set()

    for day_offset in range(-30, 8):
        for row in get_calendar_matches(day_offset=day_offset):
            home_side = row.get("Home") or {}
            away_side = row.get("Away") or {}
            _, _, home_code = _team_label(home_side)
            _, _, away_code = _team_label(away_side)
            if home_code:
                teams.add(home_code)
            if away_code:
                teams.add(away_code)

            if _is_row_finished(row):
                finished_count += 1
                total_goals += int(row["HomeTeamScore"]) + int(row["AwayTeamScore"])

    live_count = len(get_live_matches_now())

    return [
        {
            "label": "שערים",
            "value": str(total_goals),
            "change": f"{live_count} משחקים חיים",
            "icon": "⚽",
        },
        {
            "label": "משחקים",
            "value": str(finished_count),
            "change": "הושלמו",
            "icon": "🏟️",
        },
        {
            "label": "חיים",
            "value": str(live_count),
            "change": "עכשיו",
            "icon": "👥",
        },
        {
            "label": "נבחרות",
            "value": str(len(teams) or 48),
            "change": "בטורניר",
            "icon": "🌍",
        },
    ]


def fetch_tournament() -> dict[str, Any]:
    return {
        "id": "fifa-world-cup-2026",
        "name": "FIFA World Cup",
        "year": 2026,
        "startDate": "2026-06-11",
        "endDate": "2026-07-19",
        "hostCountries": ["ארה״ב", "קאנדה", "מקסיקו"],
        "totalTeams": 48,
        "totalMatches": 104,
        "totalCities": 16,
        "images": IMAGES,
    }


HANDLERS = {
    "live_matches": fetch_live_matches,
    "group_standings": fetch_group_standings,
    "top_scorers": fetch_top_scorers,
    "latest_news": fetch_latest_news,
    "stat_cards": fetch_stat_cards,
    "tournament": fetch_tournament,
}


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(f"Usage: {sys.argv[0]} <{'|'.join(HANDLERS)}>")

    resource = sys.argv[1]
    handler = HANDLERS.get(resource)
    if handler is None:
        raise SystemExit(f"Unknown resource: {resource}")

    payload = handler()
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
