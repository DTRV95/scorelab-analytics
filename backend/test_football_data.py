"""Tests for the match-data provider that need no network access.

Run with `pytest` or directly: `python test_football_data.py`.
"""

import football_data


def match(
    match_id: int,
    status: str = "FINISHED",
    home: int = 2,
    away: int = 1,
):
    return {
        "id": match_id,
        "status": status,
        "utcDate": "2026-09-13T18:30:00Z",
        "homeTeam": {"id": 1, "name": "Team A", "shortName": "A"},
        "awayTeam": {"id": 2, "name": "Team B", "shortName": "B"},
        "score": {"fullTime": {"home": home, "away": away}},
    }


def with_season(matches):
    """Serve a fixed season instead of calling the provider."""
    football_data._cache.clear()
    football_data._cache_put("matches:PPL:current", matches)


def results(fixture_ids):
    return football_data.results_for_fixtures("Liga Portugal", fixture_ids)


def test_finished_matches_report_the_final_score():
    with_season([match(101, home=3, away=2)])

    (result,) = results([101])

    assert result["finished"] is True
    assert result["home_goals"] == 3
    assert result["away_goals"] == 2
    assert result["home_name"] == "A"


def test_unplayed_matches_never_report_a_score():
    """A scheduled match must not settle anything, even with a score block."""
    with_season([match(102, status="TIMED", home=0, away=0)])

    (result,) = results([102])

    assert result["finished"] is False
    assert result["home_goals"] is None
    assert result["away_goals"] is None


def test_a_match_without_a_full_time_score_is_not_finished():
    postponed = match(103, status="FINISHED")
    postponed["score"]["fullTime"] = {"home": None, "away": None}
    with_season([postponed])

    (result,) = results([103])

    assert result["finished"] is False


def test_unknown_fixtures_are_skipped_instead_of_guessed():
    with_season([match(104)])

    assert results([999]) == []
    assert [item["fixture_id"] for item in results([104, 999])] == [104]


def test_several_fixtures_cost_a_single_season_lookup():
    with_season([match(105), match(106, home=0, away=0)])

    scores = {item["fixture_id"]: item["home_goals"] for item in results([105, 106])}

    assert scores == {105: 2, 106: 0}


def test_unsupported_leagues_fall_back_to_manual_entry():
    try:
        football_data.results_for_fixtures("Primera B", [1])
    except football_data.ProviderUnavailable:
        return
    raise AssertionError("uma liga sem dados gratuitos tem de falhar explicitamente")


def team_match(
    match_id,
    home_id,
    away_id,
    home_name="Home",
    away_name="Away",
    status="FINISHED",
    home=1,
    away=1,
    kickoff="2026-09-13T18:30:00Z",
):
    return {
        "id": match_id,
        "status": status,
        "utcDate": kickoff,
        "matchday": 1,
        "homeTeam": {"id": home_id, "name": home_name, "shortName": home_name},
        "awayTeam": {"id": away_id, "name": away_name, "shortName": away_name},
        "score": {"fullTime": {"home": home, "away": away}},
    }


def build_board_season():
    """A season with a clear favourite, a coin-flip pair, and two brand new
    teams with no history at all."""
    played = []
    for _ in range(10):
        played.append(team_match(len(played) + 1, 1, 2, "Strong FC", "Weak FC", home=3, away=0))
        played.append(team_match(len(played) + 1, 3, 4, "Mid A", "Mid B", home=1, away=1))

    upcoming = [
        team_match(9001, 1, 3, "Strong FC", "Mid A", status="SCHEDULED", kickoff="2026-09-20T18:00:00Z"),
        team_match(9002, 4, 2, "Mid B", "Weak FC", status="SCHEDULED", kickoff="2026-09-21T18:00:00Z"),
        team_match(9003, 90, 91, "New FC", "Newer FC", status="SCHEDULED", kickoff="2026-09-20T18:00:00Z"),
    ]
    return played + upcoming


def test_board_is_ordered_by_kickoff_time():
    with_season(build_board_season())

    board = football_data.probability_board(days=14)
    leaders = [(item["home_name"], item["away_name"]) for item in board["matches"]]

    assert leaders[0] == ("Strong FC", "Mid A")
    assert board["matches"] == sorted(
        board["matches"], key=lambda item: item["kickoff"] or ""
    )


def test_board_skips_a_fixture_between_two_unknown_teams():
    with_season(build_board_season())

    board = football_data.probability_board(days=14)

    assert "New FC" not in [item["home_name"] for item in board["matches"]]
    assert board["skipped"] >= 1


def test_board_reports_uncovered_competitions_as_unavailable():
    with_season(build_board_season())

    board = football_data.probability_board(days=14)

    assert "Premier League" in board["unavailable"]


def test_board_carries_the_full_breakdown_per_match():
    with_season(build_board_season())

    board = football_data.probability_board(days=14)
    (leader,) = [
        item for item in board["matches"] if item["home_name"] == "Strong FC"
    ]

    market_names = {m["mercado"] for m in leader["mercados"]}
    assert leader["headline_market"] in market_names
    assert {"Casa", "Empate", "Fora", "Ambas Marcam"} <= market_names


if __name__ == "__main__":
    checks = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for check in checks:
        check()
        print(f"ok  {check.__name__}")
    print(f"\n{len(checks)} verificações passaram")
