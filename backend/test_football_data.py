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


def build_scoreable_season(matchdays=14):
    """A league where the home side always wins 2-0.

    A model given this history should come to expect home wins, so scoring it
    against the same history has an answer known in advance: "Casa" should be
    both predicted often and right often, and "Fora" neither.
    """
    season = []
    for day in range(matchdays):
        date = f"2026-{3 + day // 4:02d}-{1 + (day % 4) * 7:02d}T18:00:00Z"
        season.append(
            team_match(len(season) + 1, 1, 2, "Home FC", "Away FC", home=2, away=0, kickoff=date)
        )
        season.append(
            team_match(len(season) + 1, 3, 4, "Casa SC", "Fora SC", home=2, away=0, kickoff=date)
        )
    return season


def test_accuracy_scores_played_fixtures_against_their_result():
    with_season(build_scoreable_season())

    report = football_data.model_accuracy("Liga Portugal")

    assert report["fixtures_scored"] > 0
    assert report["predictions"] > report["fixtures_scored"]
    # Nothing is scoreable before there is any history to forecast from.
    assert report["fixtures_skipped"] >= 1

    by_market = {row["market"]: row for row in report["markets"]}
    assert by_market["Casa"]["actual_pct"] == 100.0
    assert by_market["Fora"]["actual_pct"] == 0.0
    assert by_market["Casa"]["predicted_pct"] > by_market["Fora"]["predicted_pct"]


def test_accuracy_forecasts_each_fixture_without_seeing_it():
    """The first scoreable fixture must be forecast from one earlier matchday,
    not from the whole season. If the cutoff leaked, the model would arrive at
    every fixture already knowing how the league turns out."""
    season = build_scoreable_season()
    seen = []
    original = football_data._prefill_for_match

    def spy(matches, target, league_key, before=None):
        payload = original(matches, target, league_key, before)
        seen.append((target["utcDate"], before, payload["jogos_casa"]))
        return payload

    football_data._prefill_for_match = spy
    try:
        with_season(season)
        football_data.model_accuracy("Liga Portugal")
    finally:
        football_data._prefill_for_match = original

    assert seen, "no fixture was forecast"
    for kickoff, before, home_games in seen:
        assert before == kickoff
        # 14 matchdays in the season; a fixture can only know the ones before it.
        assert home_games < 14

    # The history grows as the season goes on, instead of being the full season
    # every time.
    assert seen[0][2] < seen[-1][2]


def test_accuracy_counts_each_event_once():
    """Five of the fifteen markets are the mirror of another one. Counting both
    sides weighs those events twice and makes the calibration curve symmetric
    by construction, so the totals cover one side of each pair only."""
    with_season(build_scoreable_season())

    report = football_data.model_accuracy("Liga Portugal")

    assert report["markets_forecast"] == 15
    assert report["markets_counted"] == 10
    assert report["predictions"] == report["fixtures_scored"] * 10

    # The mirrors keep their own row: they are worth reading on their own.
    rows = {row["market"] for row in report["markets"]}
    assert "Menos de 3.5 Golos" in rows
    assert "Mais de 3.5 Golos" in rows

    # Each row says whether it is one of the counted ten, so a page listing
    # them does not have to keep its own copy of which markets mirror which.
    flags = {row["market"]: row["counted"] for row in report["markets"]}
    assert flags["Mais de 3.5 Golos"] is True
    assert flags["Menos de 3.5 Golos"] is False
    assert sum(flags.values()) == report["markets_counted"]

    counted = sum(band["samples"] for band in report["calibration"])
    assert counted == report["predictions"]


def build_varied_season(matchdays=16):
    """A league with mixed results, so no market lands every single time.

    build_scoreable_season is deliberately degenerate — the home side always
    wins 2-0 — which makes every base rate 0 or 1 and the baseline perfect.
    Measuring skill needs a league where the answer is not already known.
    """
    season = []
    results = [(2, 0), (1, 1), (0, 2), (3, 1), (0, 0), (1, 2)]
    for day in range(matchdays):
        date = f"2026-{3 + day // 4:02d}-{1 + (day % 4) * 7:02d}T18:00:00Z"
        for pair, (home_id, away_id) in enumerate([(1, 2), (3, 4)]):
            home, away = results[(day + pair) % len(results)]
            season.append(
                team_match(
                    len(season) + 1, home_id, away_id,
                    f"T{home_id}", f"T{away_id}",
                    home=home, away=away, kickoff=date,
                )
            )
    return season


def test_accuracy_compares_the_forecast_to_knowing_nothing():
    """A Brier score alone says nothing. The comparison that means something is
    against always quoting how often a market lands, ignoring the match."""
    with_season(build_varied_season())

    report = football_data.model_accuracy("Liga Portugal")

    assert report["baseline_brier"] > 0, "a varied league has real base rates"
    assert 0 <= report["brier"] <= 1

    # The forecast is simulated, so the exact score moves a little between
    # runs; what has to hold is that the skill figure says the same thing the
    # two scores do.
    expected = (1 - report["brier"] / report["baseline_brier"]) * 100
    assert abs(report["skill_pct"] - expected) < 0.5
    if report["brier"] < report["baseline_brier"]:
        assert report["skill_pct"] > 0
    else:
        assert report["skill_pct"] <= 0


def test_accuracy_claims_no_skill_when_the_answer_was_never_in_doubt():
    """Where a market lands every time, knowing the base rate is already
    perfect, and the model cannot claim credit for matching it."""
    with_season(build_scoreable_season())

    report = football_data.model_accuracy("Liga Portugal")

    assert report["baseline_brier"] == 0
    assert report["skill_pct"] == 0


def test_accuracy_buckets_predictions_by_confidence():
    with_season(build_scoreable_season())

    report = football_data.model_accuracy("Liga Portugal")

    assert report["calibration"], "no calibration bands"
    for band in report["calibration"]:
        low, high = band["bucket"].rstrip("%").split("-")
        assert int(low) <= band["predicted_pct"] <= int(high)
    assert 0 <= report["brier"] <= 1
    assert report["headline"]["predictions"] > 0


def test_accuracy_is_cached_per_league_and_season():
    with_season(build_scoreable_season())

    first = football_data.model_accuracy("Liga Portugal")

    original = football_data._prefill_for_match

    def refuse(*args, **kwargs):
        raise AssertionError("recomputed a season that was already scored")

    # A second call must be served from the cache, not pay for the whole
    # season again: a league costs one simulation per fixture.
    football_data._prefill_for_match = refuse
    try:
        second = football_data.model_accuracy("Liga Portugal")
    finally:
        football_data._prefill_for_match = original

    assert second is first


if __name__ == "__main__":
    checks = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for check in checks:
        check()
        print(f"ok  {check.__name__}")
    print(f"\n{len(checks)} verificações passaram")
