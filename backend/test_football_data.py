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


if __name__ == "__main__":
    checks = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for check in checks:
        check()
        print(f"ok  {check.__name__}")
    print(f"\n{len(checks)} verificações passaram")
