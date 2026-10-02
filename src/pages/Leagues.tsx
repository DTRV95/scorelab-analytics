import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, TrendingUp } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { LeaguesHealth } from "@/components/LeaguesHealth";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { COVERED_LEAGUES } from "@/lib/boardLeagues";
import {
  fetchLeagueReport,
  groupMarkets,
  standsOut,
  type FormRow,
  type LeagueMarket,
  type LeagueReport,
} from "@/lib/leagueReport";

const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };

const RUN_TONE: Record<string, string> = {
  V: "bg-[hsl(var(--sl-green))] text-white",
  E: "bg-muted text-muted-foreground",
  D: "bg-destructive text-white",
};

/** The last few games, oldest on the left, as anybody writes a run of form. */
function Run({ run }: { run: string }) {
  return (
    <span className="flex flex-none gap-0.5" aria-label={`Forma: ${run}`}>
      {run.split("").map((result, index) => (
        <span
          key={`${result}-${index}`}
          aria-hidden
          className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold ${
            RUN_TONE[result] ?? "bg-muted"
          }`}
        >
          {result}
        </span>
      ))}
    </span>
  );
}

/**
 * The three markets everybody actually bets, big enough to read at arm's
 * length.
 *
 * On a phone the groups below are four screens of scrolling, and the first
 * question anybody opens a competition with — ganha-se em casa? dá golos? —
 * was at the bottom of the third. Here it is answered before the thumb moves.
 */
const HEADLINE: { market: string; label: string }[] = [
  { market: "Casa", label: "Ganha em casa" },
  { market: "Mais de 2.5 Golos", label: "Mais de 2.5" },
  { market: "Ambas Marcam", label: "Ambas marcam" },
];

function Headline({ markets, played }: { markets: LeagueMarket[]; played: number }) {
  const rows = HEADLINE.map((head) => ({
    ...head,
    row: markets.find((market) => market.mercado === head.market),
  })).filter((entry) => entry.row);

  if (rows.length === 0) return null;

  return (
    <div className="sl-card grid grid-cols-3 gap-px overflow-hidden bg-border">
      {rows.map(({ label, row }) => (
        // A column, so a label that takes two lines on a narrow phone does
        // not push its own count below the other two.
        <div key={label} className="flex flex-col bg-card px-3 py-3 text-center">
          <p className="sl-figure text-[26px] leading-none text-foreground">
            {row!.pct === null ? "—" : `${row!.pct.toFixed(0)}%`}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold leading-tight text-foreground">
            {label}
          </p>
          <p className="sl-meta mt-auto pt-0.5 text-[10px]">
            {row!.jogos} de {played}
          </p>
        </div>
      ))}
    </div>
  );
}

function Form({ rows, window }: { rows: FormRow[]; window: number }) {
  if (rows.length === 0) return null;

  return (
    <section className="sl-card overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          Quem está em forma
        </h2>
        <p className="sl-meta text-[11px]">
          Pontos nos últimos {window} jogos de cada equipa. Três por vitória,
          um por empate.
        </p>
      </div>

      <div className="divide-y divide-border">
        {rows.map((row, index) => (
          <div key={row.team} className="flex items-center gap-3 px-4 py-2.5">
            <span className="sl-figure w-4 flex-none text-[12px] text-muted-foreground">
              {index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">
                {row.team}
              </p>
              <p className="sl-meta text-[11px]">
                {row.won}V · {row.drawn}E · {row.lost}D · {row.scored}-
                {row.conceded}
              </p>
            </div>

            <Run run={row.run} />

            <span className="sl-figure w-9 flex-none text-right text-[14px] text-foreground">
              {row.points}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * What a competition actually does.
 *
 * The forecasts answer "what happens in this match"; nothing answered "what
 * happens in this league". How often a home side wins in Serie A, how often
 * three goals turn up, which three teams are on a run — all of it is already
 * in the season the board keeps cached, and none of it was ever shown.
 */
export default function Leagues() {
  const [league, setLeague] = useState<string>(COVERED_LEAGUES[0]);
  const [report, setReport] = useState<LeagueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((name: string) => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchLeagueReport(name)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch(() => {
        if (!cancelled) {
          setReport(null);
          setError("Não foi possível ler esta competição agora.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(league), [league, load]);

  // Twelve chips do not fit a phone, so the one that is open can sit off the
  // side of the screen — the page would then be showing a competition whose
  // name is nowhere to be seen.
  const chips = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const chosen = chips.current?.querySelector('[aria-pressed="true"]');
    // Guarded because not every environment implements it, and a page that
    // throws here would render nothing at all.
    chosen?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [league]);

  const groups = useMemo(
    () => (report ? groupMarkets(report.markets) : []),
    [report],
  );

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5 md:px-6 md:pb-6"
      >
        <motion.div variants={fadeUp} className="-mt-3 md:-mt-[1rem]">
          <h1 className="sl-section-title text-[15px]">Ligas</h1>
          <p className="sl-meta mt-1 text-[11px]">
            O que cada competição costuma dar, pelos jogos desta época.
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          ref={chips}
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-5 sm:px-5 [&::-webkit-scrollbar]:hidden"
        >
          {COVERED_LEAGUES.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={name === league}
              onClick={() => setLeague(name)}
              className={`sl-tap flex-none rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                name === league
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground ring-1 ring-border"
              }`}
            >
              {name}
            </button>
          ))}
        </motion.div>

        {loading && (
          <motion.p
            variants={fadeUp}
            className="sl-card flex items-center gap-2 px-4 py-4 text-[13px] text-muted-foreground"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />A ler a época do{" "}
            {league}...
          </motion.p>
        )}

        {error && !loading && (
          <motion.div variants={fadeUp} className="sl-card px-4 py-4">
            <p className="text-[13px] text-foreground">{error}</p>
            <button
              type="button"
              onClick={() => load(league)}
              className="sl-tap mt-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-primary ring-1 ring-border"
            >
              Tentar outra vez
            </button>
          </motion.div>
        )}

        {report && !loading && report.played === 0 && (
          <motion.p
            variants={fadeUp}
            className="sl-card px-4 py-4 text-[13px] leading-6 text-muted-foreground"
          >
            Ainda não há jogos disputados nesta competição esta época. Sem
            jogos não há percentagens para tirar.
          </motion.p>
        )}

        {report && !loading && report.played > 0 && (
          <>
            <motion.div variants={fadeUp}>
              <Headline markets={report.markets} played={report.played} />
            </motion.div>

            {/* The three numbers that frame the rest, in one line rather than
                a card of their own: on a phone a second grid of tiles pushed
                the markets off the first screen. */}
            <motion.p
              variants={fadeUp}
              className="sl-meta flex flex-wrap items-center gap-x-2 px-1 text-[11px]"
            >
              <span className="font-semibold text-foreground">
                {report.played} jogos
              </span>
              <span aria-hidden>·</span>
              <span>
                {report.goals.total_avg?.toFixed(2) ?? "—"} golos por jogo
              </span>
              <span aria-hidden>·</span>
              <span>
                {report.goals.home_avg?.toFixed(1) ?? "—"} casa /{" "}
                {report.goals.away_avg?.toFixed(1) ?? "—"} fora
              </span>
            </motion.p>

            {/* Green here is not "good", it is "often": on this page nothing
                is a bet yet, so a colour that said good or bad would be
                saying something the numbers do not. */}
            <motion.p
              variants={fadeUp}
              className="sl-meta flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px]"
            >
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-full bg-[hsl(var(--sl-green))]" />
                acontece em 65% ou mais dos jogos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-full bg-muted-foreground/40" />
                em 25% ou menos
              </span>
            </motion.p>

            {groups.map((group) => (
              <motion.section
                key={group.title}
                variants={fadeUp}
                className="sl-card overflow-hidden"
              >
                <div className="border-b border-border px-4 py-2.5">
                  <h2 className="text-[13px] font-semibold text-foreground">
                    {group.title}
                  </h2>
                </div>

                <div className="space-y-2.5 px-4 py-3">
                  {group.markets.map((market) => {
                    const pct = market.pct ?? 0;
                    const flag = standsOut(market.pct);

                    return (
                      <div key={market.mercado}>
                        {/* The percentage reads with the market's name, and
                            the count under the bar: the other way round, the
                            eye met "42 de 94" first and the figure that
                            matters second. */}
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 truncate text-[12.5px] font-semibold text-foreground">
                            {MARKET_LABELS[market.mercado] ?? market.mercado}
                          </span>
                          <span className="sl-figure flex-none text-[14px] text-foreground">
                            {market.pct === null
                              ? "—"
                              : `${market.pct.toFixed(0)}%`}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${
                                flag === "alto"
                                  ? "bg-[hsl(var(--sl-green))]"
                                  : flag === "baixo"
                                    ? "bg-muted-foreground/40"
                                    : "bg-primary"
                              }`}
                              style={{ width: `${Math.max(pct, 1.5)}%` }}
                            />
                          </div>
                          <span className="sl-meta w-14 flex-none text-right text-[10px]">
                            {market.jogos} de {report.played}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.section>
            ))}

            <motion.div variants={fadeUp}>
              <Form rows={report.form.slice(0, 3)} window={report.form_window} />
            </motion.div>

            <motion.p variants={fadeUp} className="sl-meta px-1 text-[11px] leading-5">
              Tudo contado sobre os {report.played} jogos já disputados desta
              época. É o que a competição deu, não o que vai dar.
            </motion.p>
          </>
        )}
        {/* Last, because it answers a question nobody has until something
            looks wrong: está a chegar tudo? */}
        <motion.div variants={fadeUp}>
          <LeaguesHealth />
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
