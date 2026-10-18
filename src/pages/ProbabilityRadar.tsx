import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ChevronDown,
  Info,
  Layers3,
  ListFilter,
  Loader2,
  RefreshCw,
  Sliders,
  Sparkles,
  Star,
} from "lucide-react";
import { useFavourites } from "@/hooks/useFavourites";
import type { ScoredMatch } from "@/lib/boardResults";
import { useMaybePlanBoard } from "@/hooks/usePlanBoard";
import type { PickedGame } from "@/components/GamePicker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppLayout } from "@/components/layout/AppLayout";
import { PickReadings } from "@/components/PickReadings";
import { RecentHits } from "@/components/RecentHits";
import { SectionCard, FormField, SelectField } from "@/components/AnalysisFormControls";
import { TodayMatches, dayKey, dayLabels, timeLabel } from "@/components/TodayMatches";
import { LeagueCalibration } from "@/components/LeagueCalibration";
import {
  ProbabilityBreakdown,
  MARKET_LABELS,
  type ProbabilityResult,
} from "@/components/ProbabilityBreakdown";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/apiConfig";
import {
  DEFAULT_LEAGUE_KEY,
  LEAGUE_PRESETS,
  LEAGUE_PRESET_MAP,
} from "@/lib/leaguePresets";
import {
  fetchPrefill,
  MatchForm,
  type PrefillForm,
} from "@/components/MatchForm";
import {
  fetchNewerBoard,
  loadBoard,
  type LoadedBoard,
} from "@/lib/boardSource";
import {
  minimumOdd,
  SHORTLIST_MIN_PCT,
  shortlistOf,
} from "@/lib/shortlist";
import { useBoardResults } from "@/hooks/useBoardResults";
import {
  readCachedBoard,
  type BoardMatch,
} from "@/lib/probabilityBoardCache";
import { freshness } from "@/lib/freshness";
import {
  PULL_THRESHOLD,
  usePullToRefresh,
} from "@/hooks/usePullToRefresh";
import { matchTips, type MatchTip } from "@/lib/matchTips";
import { useLeagueRates } from "@/hooks/useLeagueRates";
import { fadeUp, stagger } from "@/lib/motion";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const BOARD_DAYS = 7;

// The engine sleeps after a quarter of an hour alone, and a cold start plus
// eleven competitions is more than the minute and a half this used to give
// it: the wait ended just before the answer did, every time.
const ENGINE_WAIT_MS = 150_000;

interface FormData {
  equipa_casa: string;
  equipa_fora: string;
  liga: string;

  jogos_casa: string;
  golos_marcados_casa: string;
  golos_sofridos_casa: string;
  jogos_casa_rec: string;
  golos_marcados_casa_rec: string;
  golos_sofridos_casa_rec: string;

  jogos_fora: string;
  golos_marcados_fora: string;
  golos_sofridos_fora: string;
  jogos_fora_rec: string;
  golos_marcados_fora_rec: string;
  golos_sofridos_fora_rec: string;

  league_home_goals_avg: string;
  league_away_goals_avg: string;
  dixon_coles_rho: string;
  shrinkage_matches: string;
}

const initialFormData: FormData = {
  equipa_casa: "",
  equipa_fora: "",
  liga: DEFAULT_LEAGUE_KEY,

  jogos_casa: "0",
  golos_marcados_casa: "0",
  golos_sofridos_casa: "0",
  jogos_casa_rec: "0",
  golos_marcados_casa_rec: "0",
  golos_sofridos_casa_rec: "0",

  jogos_fora: "0",
  golos_marcados_fora: "0",
  golos_sofridos_fora: "0",
  jogos_fora_rec: "0",
  golos_marcados_fora_rec: "0",
  golos_sofridos_fora_rec: "0",

  ...LEAGUE_PRESET_MAP[DEFAULT_LEAGUE_KEY],
};

function kickoffTime(kickoff: string | null) {
  if (!kickoff) return "";
  const date = new Date(kickoff);
  if (Number.isNaN(date.getTime())) return "";
  return timeLabel(date);
}

/**
 * What this game has that an ordinary game of its league does not.
 *
 * Read while browsing, not while betting: the forecast was already on the row
 * and the league's own rate was on another page, so a 62% had no scale to be
 * read against.
 */
function Tips({ tips, league }: { tips: MatchTip[]; league: string }) {
  if (tips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-[hsl(var(--sl-green))]/5 px-4 py-2">
      <Sparkles className="h-3 w-3 flex-none text-[hsl(var(--sl-green))]" />
      {tips.map((tip) => (
        <span
          key={tip.market}
          className="text-[11px] leading-5 text-foreground"
          title={`${league}: ${tip.leaguePct}% dos jogos`}
        >
          <span className="font-semibold">
            {MARKET_LABELS[tip.market] ?? tip.market}
          </span>{" "}
          <span className="sl-figure">{tip.modelPct}%</span>
          <span className="sl-meta"> · a liga dá {tip.leaguePct}%</span>
        </span>
      ))}
    </div>
  );
}

function BoardMatchRow({
  match,
  tips,
  isExpanded,
  onToggle,
  onContinue,
  favourite,
  onFavourite,
  onAddToChallenge,
  verdict,
}: {
  match: BoardMatch;
  /** Where this game stands out from its own competition. */
  tips: MatchTip[];
  isExpanded: boolean;
  onToggle: () => void;
  onContinue: () => void;
  /** Se este jogo está guardado nos favoritos desta conta. */
  favourite: boolean;
  onFavourite: () => void;
  /** Dado, cada mercado aberto leva directamente ao boletim do desafio. */
  onAddToChallenge?: (market: string, pct: number) => void;
  /** O jogo já jogado e marcado contra o que o quadro disse. */
  verdict?: ScoredMatch;
}) {
  /**
   * Três momentos, e não dois.
   *
   * Um jogo cuja hora passou não está decidido: está a jogar-se, e durante
   * noventa minutos não há nada honesto a dizer sobre ele. Dois tempos e o
   * intervalo dão cerca de duas horas, por isso é esse o limite entre "a
   * decorrer" e "já acabou, o resultado é que ainda não chegou" — o motor
   * marca os jogos de três em três horas.
   */
  const kickoff = match.kickoff ? new Date(match.kickoff).getTime() : null;
  const since = kickoff === null ? null : Date.now() - kickoff;
  const started = !verdict && since !== null && since > 0;
  const playing = started && since !== null && since < 2.2 * 60 * 60 * 1000;
  /** The form behind the number, for whoever asks for it. */
  const [moreOpen, setMoreOpen] = useState(false);
  const [prefill, setPrefill] = useState<PrefillForm | null>(null);
  const [asking, setAsking] = useState(false);

  // Asked for when somebody opens it, and not a moment before: fifteen rows
  // on screen would be fifteen requests nobody wanted, and most people only
  // want the forecast. Held for the session afterwards, so closing and
  // reopening is instant.
  useEffect(() => {
    if (!moreOpen || prefill) return;

    let cancelled = false;
    setAsking(true);
    fetchPrefill(match.league, match.fixture_id)
      .then((data) => {
        if (!cancelled && data) setPrefill(data);
      })
      .finally(() => {
        if (!cancelled) setAsking(false);
      });

    return () => {
      cancelled = true;
    };
    // Deliberately not watching `asking`: it is set inside this effect, and
    // reacting to it re-ran the effect, whose cleanup then cancelled the
    // request it had just made.
  }, [moreOpen, prefill, match.league, match.fixture_id]);

  return (
    <article className="sl-card sl-card-interactive overflow-hidden">
      {/* One number per row on purpose. An earlier version also showed a
          1/X/2 strip, which left two different percentages competing for the
          same glance — the strongest outcome and the strongest market are
          rarely the same line. The full set is one tap away, and so is how
          much history backs it: the sample badge used to sit here too, a
          second verdict on a line that only has room for one. */}
      {/* Duas coisas a fazer nesta linha, e por isso dois controlos: o
          corpo abre os mercados, a estrela guarda o jogo. A estrela é uma
          coluna à parte, com um fio a separá-la, porque um botão dentro de
          outro botão não existe — e porque assim lê-se como o que é. */}
      <div className="flex items-stretch">
      <button
        type="button"
        className="sl-meter flex min-w-0 flex-1 items-center gap-2.5 py-3.5 pl-4 pr-1 text-left"
        data-verdict={verdict ? (verdict.landed ? "hit" : "miss") : undefined}
        style={{ "--sl-meter": `${match.headline_pct}%` } as CSSProperties}
        onClick={onToggle}
      >
        {/* A mesma linha que está no Início: jogo e mercado à esquerda, a
            probabilidade sozinha à direita, e a seta no fim, onde uma seta
            de abrir se espera. Estava ao contrário — a seta à esquerda a
            abrir uma vala antes do nome, e três linhas à direita a
            disputar o sítio onde só cabe um número. */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-snug tracking-[-0.015em] text-foreground">
            {match.home_name} vs {match.away_name}
          </p>
          <p className="truncate text-[12px] font-semibold text-foreground/80">
            {MARKET_LABELS[match.headline_market] ?? match.headline_market}
          </p>
          {/* Antes do apito, a hora e o preço a que isto deixa de valer a
              pena. Depois dele, o que aconteceu — porque a hora de um jogo
              que já se jogou não interessa a ninguém, e o preço mínimo de
              uma previsão já decidida ainda menos.

              A odd mínima desceu para aqui, ao lado da hora. Estava na
              coluna da direita, por baixo da percentagem, e essa coluna
              tem uma regra: um número, e só um.

              Acertar não é ganhar: ao preço mínimo a aposta fica a zero, e
              a casa de apostas também sabe que esta equipa não perde. */}
          {verdict ? (
            <p className="flex items-center gap-1.5 truncate text-[11px] font-bold">
              <span
                className={
                  verdict.landed
                    ? "text-[hsl(var(--sl-green))]"
                    : "text-destructive"
                }
              >
                {verdict.landed ? "Entrou" : "Não entrou"}
              </span>
              <span className="font-mono-data font-bold text-foreground">
                {verdict.home_goals}–{verdict.away_goals}
              </span>
            </p>
          ) : started ? (
            <p className="sl-meta truncate text-[11px]">
              {playing ? "A decorrer" : "À espera do resultado"}
            </p>
          ) : (
            <p className="sl-meta truncate text-[11px]">
              {kickoffTime(match.kickoff)} · odd mín.{" "}
              <span className="font-mono-data font-bold text-foreground">
                {minimumOdd(match.headline_pct).toFixed(2)}
              </span>
            </p>
          )}
        </div>

        <div className="flex-none text-right">
          <p
            className={`sl-figure text-[30px] leading-none ${
              verdict && !verdict.landed
                ? "text-muted-foreground/70"
                : "sl-hero-figure sl-hero-figure-green text-[hsl(var(--sl-green))]"
            }`}
          >
            {match.headline_pct.toFixed(0)}
            <span className="text-[16px]">%</span>
          </p>
        </div>

        <ChevronDown
          className={`h-4 w-4 flex-none text-muted-foreground transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <button
        type="button"
        aria-pressed={favourite}
        aria-label={
          favourite
            ? `Tirar ${match.home_name} vs ${match.away_name} dos favoritos`
            : `Guardar ${match.home_name} vs ${match.away_name} nos favoritos`
        }
        onClick={onFavourite}
        className={`sl-tap flex w-11 flex-none items-center justify-center transition-colors ${
          favourite
            ? "text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning))]/10"
            : "text-muted-foreground/45 hover:bg-muted/60 hover:text-muted-foreground"
        }`}
      >
        <Star
          className="h-[18px] w-[18px]"
          strokeWidth={2}
          fill={favourite ? "currentColor" : "none"}
        />
      </button>
      </div>

      <Tips tips={tips} league={match.league} />

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-border bg-[hsl(var(--sl-surface))] px-3.5 py-4 sm:px-4">
              {/* Antes dos quinze mercados: o que o registo do quadro diz
                  desta escolha em concreto — o mercado, a força do número e
                  o jogo, que são três perguntas diferentes. */}
              <PickReadings match={match} />

              {/* Com um desafio a decorrer, cada mercado é um atalho para
                  o boletim dele: estava-se a olhar para a probabilidade,
                  e o passo seguinte era sair daqui, abrir o desafio e
                  procurar o mesmo jogo numa lista. */}
              {onAddToChallenge && (
                <p className="sl-meta -mb-2 px-0.5 text-[11px]">
                  Carrega num mercado para o pôr no boletim do desafio.
                </p>
              )}
              <ProbabilityBreakdown data={match} onPick={onAddToChallenge} />

              {/* What the forecast was built from, for whoever wants to look
                  behind the number. Behind a tap, because most people are
                  here for the forecast and this is a wall of goals per game
                  under every single row. */}
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setMoreOpen((open) => !open)}
                  aria-expanded={moreOpen}
                  className="sl-tap flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
                >
                  <Info className="h-3.5 w-3.5 flex-none text-muted-foreground" />
                  <span className="min-w-0 flex-1 text-[12px] font-semibold text-foreground">
                    Mais informações
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 flex-none text-muted-foreground transition-transform ${
                      moreOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {moreOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border px-3.5 py-3">
                        <p className="text-[12px] font-bold text-foreground">
                          A forma por trás do número
                        </p>
                        <p className="sl-meta mt-0.5 text-[11px] leading-5">
                          Golos por jogo, por lado, na época e nos últimos
                          jogos.
                        </p>

                        <div className="mt-2.5">
                          {prefill ? (
                            <MatchForm prefill={prefill} match={match} />
                          ) : (
                            <p className="sl-meta flex items-center gap-2 text-[11px]">
                              {asking ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />A
                                  ler a época destas equipas...
                                </>
                              ) : (
                                "A época destas equipas não veio desta vez."
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="rounded-xl border border-border bg-card p-3.5">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Queres ver o jogo todo? A análise avançada abre-o numa página
                  só dele, com as tuas odds em cada mercado para dizer onde
                  está o valor, e como o modelo se tem portado nestes mercados.
                </p>
                <Button
                  className="sl-btn-primary mt-3 h-10 w-full gap-2 text-xs"
                  onClick={onContinue}
                >
                  Análise avançada
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

/** Go and ask the provider again, now, ignoring anything already stored. */
/**
 * The button for when something is missing from the board.
 *
 * There was already a refresh icon in the corner of the header, and it was
 * not enough twice over: an icon says nothing about how old the board is,
 * so there is no way to tell a board that is missing a competition from one
 * that is simply the board, and it said nothing back when pressed, so a
 * minute of silence looked exactly like a button that does nothing.
 *
 * So: when the quadro was computed, what it holds, which competitions are
 * missing from it, and a line that changes while the thing works.
 */
function BoardRefresh({
  at,
  games,
  missing,
  loading,
  note,
  onClick,
}: {
  at: number;
  games: number;
  missing: string[];
  loading: boolean;
  note: string;
  onClick: () => void;
}) {
  const summary = [
    at ? `Quadro de ${freshness(at)}` : "Quadro ainda por carregar",
    games ? `${games} jogos` : null,
    missing.length ? `falta ${missing.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="sl-card flex items-center gap-3 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground">
          {loading ? "A atualizar o quadro..." : summary}
        </p>
        {/* A frase que explica para que serve o botão só aparece quando há
            motivo para ele: depois de uma tentativa, ou quando falta mesmo
            uma competição. Fixa, eram duas linhas de ensino permanente por
            cima dos jogos — e o botão diz "Atualizar", que já é a frase. */}
        {(note || missing.length > 0) && (
          <p className="sl-meta mt-0.5 text-[11px] leading-4">
            {note || "Falta uma competição? Vai buscar o mais recente."}
          </p>
        )}
      </div>
      {/* Em contorno, não em laranja cheio: ir buscar o quadro outra vez é
          uma utilidade, e o laranja da casa é para o botão que compromete
          dinheiro. Cheio, era o que mais gritava numa página de jogos. */}
      <Button
        variant="outline"
        className="sl-tap h-9 flex-none px-3.5 text-xs font-bold"
        disabled={loading}
        onClick={onClick}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        Atualizar
      </Button>
    </div>
  );
}

function SearchAgain({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      className="sl-btn-primary sl-tap mt-3 h-10 w-full text-xs sm:w-auto sm:px-5"
      disabled={loading}
      onClick={onClick}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? "A procurar jogos..." : "Procurar jogos outra vez"}
    </Button>
  );
}

/**
 * The odds-free half of an analysis: what the model thinks will happen,
 * before ever looking at a bookmaker's price. This never becomes a bet on
 * its own — for value, stake and a decision, the same data continues into
 * Match Analysis once real odds are on the table.
 */
export default function ProbabilityRadar() {
  const navigate = useNavigate();

  // The auto-ranked board: the primary view, no match-picking required.
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [board, setBoard] = useState<BoardMatch[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState("");
  const [unavailableLeagues, setUnavailableLeagues] = useState<string[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  // What each competition has given this season, to read every forecast on
  // this page against. One request for all of them, held for the session.
  const rates = useLeagueRates();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  // When the board on the screen was computed, and what the last press of
  // the refresh button did — the two things somebody needs to decide
  // whether to press it again.
  const [boardAt, setBoardAt] = useState(0);
  const [refreshNote, setRefreshNote] = useState("");
  const [activeDay, setActiveDay] = useState(0);
  // Yesterday sits in the same row of chips as today and tomorrow, and is
  // the one of them that has already happened.
  const [yesterdayOpen, setYesterdayOpen] = useState(false);
  // The shortlist is the day read through the board's own record. Off by
  // default: the whole day is still what the page is for.
  const [onlyShortlist, setOnlyShortlist] = useState(false);
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  const favoritos = useFavourites();
  const hits = useBoardResults();

  /**
   * O que já está marcado, por jogo.
   *
   * O quadro diz o que vai acontecer e, até agora, no dia seguinte já
   * tinha passado à semana seguinte: o separador de ontem guardava o
   * acerto todo somado, mas a linha de cada jogo nunca dizia se aquilo
   * que ela própria previu se confirmou.
   */
  const marcados = useMemo(() => {
    const porJogo = new Map<number, ScoredMatch>();
    (hits.results?.matches ?? []).forEach((scored) => {
      porJogo.set(scored.fixture_id, scored);
    });
    return porJogo;
  }, [hits.results]);

  /**
   * Do quadro para o boletim, sem passar pelo meio.
   *
   * Só os desafios a decorrer: juntar um jogo a um que já acabou não quer
   * dizer nada. Com um, vai-se directo; com mais do que um, pergunta-se
   * qual — porque adivinhar aqui é pôr dinheiro no sítio errado.
   */
  const planBoard = useMaybePlanBoard()?.board ?? null;
  const aDecorrer = useMemo(
    () =>
      (planBoard?.challenges ?? []).filter((entry) => !entry.plan.ended_at),
    [planBoard],
  );
  const [aEscolherDesafio, setAEscolherDesafio] = useState<PickedGame | null>(
    null,
  );

  const levarParaODesafio = useCallback(
    (planId: string, game: PickedGame) => {
      setAEscolherDesafio(null);
      navigate(`/desafios/${planId}`, { state: { juntar: game } });
    },
    [navigate],
  );

  const juntarAoDesafio = useCallback(
    (match: BoardMatch, market: string, pct: number) => {
      const game: PickedGame = {
        fixtureId: match.fixture_id,
        homeTeam: match.home_name,
        awayTeam: match.away_name,
        league: match.league,
        market,
        modelProb: pct,
        kickoff: match.kickoff,
        // O preço é a única coisa que o quadro não sabe: é o que se
        // escreve a seguir, já com a perna no boletim.
        odds: "",
      };

      if (aDecorrer.length === 1) {
        levarParaODesafio(aDecorrer[0].plan.id, game);
        return;
      }
      setAEscolherDesafio(game);
    },
    [aDecorrer, levarParaODesafio],
  );
  // Closed by default on phones so the actual board — the reason someone
  // opens this page — isn't pushed below the fold by an explainer paragraph.
  const [infoOpen, setInfoOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 768
  );

  // The manual path: kept for leagues or matchups the auto board can't cover.
  const [manualOpen, setManualOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [manualResult, setManualResult] = useState<ProbabilityResult | null>(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");

  // reloadToken only advances when the user hits refresh — a plain remount
  // (navigating away and back) always leaves it at 0.
  const isManualRefresh = reloadToken > 0;

  /** Ask whether there is a data source at all, again. */
  const searchAgain = () => setReloadToken((token) => token + 1);

  const applyBoard = useCallback((data: LoadedBoard) => {
    setBoard(data.matches);
    setUnavailableLeagues(data.unavailable);
    setSkippedCount(data.skipped);
    setBoardAt(data.computedAt);
  }, []);

  /**
   * The button for when a competition is missing.
   *
   * Two steps, in the order that costs least. First the board in the
   * database, which four jobs a night rewrite and which answers in an
   * instant: nine times out of ten that is the whole answer, and it is the
   * step that was missing the day the Championship showed one game of four.
   * Only if that one is no newer than what is on screen does it go and wake
   * the engine, which is slow, sleeps, and is the only thing that can
   * produce a board nobody has computed yet.
   *
   * It says which step it is on, because a minute of nothing is what makes
   * somebody press a button four times.
   */
  const refreshBoard = useCallback(async () => {
    setBoardLoading(true);
    setBoardError("");
    setRefreshNote("À procura de um quadro mais recente...");

    try {
      const newer = await fetchNewerBoard(BOARD_DAYS, boardAt);
      if (newer) {
        applyBoard(newer);
        setRefreshNote(`Quadro atualizado: ${newer.matches.length} jogos.`);
        return;
      }

      setRefreshNote(
        "Já tens o mais recente guardado. A pedir um novo ao motor — pode demorar até dois minutos se esteve parado.",
      );

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), ENGINE_WAIT_MS);
      try {
        const fresh = await loadBoard(BOARD_DAYS, {
          force: true,
          signal: controller.signal,
        });
        if (fresh.matches.length === 0) {
          setRefreshNote(
            "O motor não devolveu jogos nenhuns — costuma ser o limite de pedidos do fornecedor. Tenta daqui a um minuto.",
          );
          return;
        }
        applyBoard(fresh);
        setRefreshNote(
          fresh.source === "engine"
            ? `Quadro recalculado agora: ${fresh.matches.length} jogos.`
            : `Quadro atualizado: ${fresh.matches.length} jogos.`,
        );
      } finally {
        window.clearTimeout(timeout);
      }
    } catch {
      // Whatever went wrong, the board on the screen stays on the screen.
      setRefreshNote(
        "Não foi possível recalcular agora. Fica o quadro que já tinhas.",
      );
    } finally {
      setBoardLoading(false);
    }
  }, [applyBoard, boardAt]);

  /** Puxar para baixo no topo vale o mesmo que carregar em atualizar. */
  const pulled = usePullToRefresh({
    onRefresh: () => void refreshBoard(),
    disabled: boardLoading,
  });

  useEffect(() => {
    // Answered once, answered for this visit.
    //
    // This question — is there a data source at all — has one answer per
    // page, and "no" hides the board behind a notice. Asking it again on
    // every refresh is how a board that was on the screen disappeared: the
    // button asks the engine, the engine was asleep, ninety seconds later
    // the answer is "no" and the games in the database go with it. The
    // refresh is about the board; this is not the board.
    if (enabled === true) return;

    // A fresh cached board proves the backend answered recently — skip the
    // status round trip entirely and let the board effect serve the cache.
    if (!isManualRefresh && readCachedBoard(BOARD_DAYS)) {
      setEnabled(true);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90_000);

    // Last night's board, from the database, settles the question without
    // waking anything: a board that exists is proof enough that the engine
    // is set up, and asking it to confirm that cost the page a minute of
    // "A ligar ao motor de dados..." every time it had been left alone.
    if (!isManualRefresh) {
      void loadBoard(BOARD_DAYS)
        .then((data) => {
          if (cancelled) return;
          if (data.matches.length > 0) {
            setEnabled(true);
            window.clearTimeout(timeout);
            return;
          }
          probeStatus();
        })
        .catch(() => {
          if (!cancelled) probeStatus();
        });
    } else {
      probeStatus();
    }

    function probeStatus() {
      if (cancelled) return;
      fetch(buildApiUrl("/data/status"), { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setEnabled(Boolean(data?.configured));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      })
      .finally(() => window.clearTimeout(timeout));
    }

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [reloadToken, isManualRefresh, enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Once loaded for these days, stay loaded: reopening the tab (or the
    // whole browser, within the cache window) shows the same board
    // instantly instead of recomputing it.
    // The stored copy is read on the spot, not through a promise: reopening
    // the tab should paint the board in the same breath, with no frame of
    // emptiness in between.
    const cached = readCachedBoard(BOARD_DAYS);
    if (cached) {
      applyBoard({
        matches: cached.matches,
        unavailable: cached.unavailable,
        skipped: cached.skipped,
        source: "cache",
        at: cached.fetchedAt,
        computedAt: cached.computedAt,
      });
      setBoardLoading(false);
      setBoardError("");

      // Painted — and then, quietly, the question that was never asked:
      // is the board in the database newer than this one? It usually is
      // not, and costs one column to find out. When it is, the page
      // swaps it in where you are looking, instead of holding yesterday's
      // copy for two hours because that is how long the cache lasts.
      let stale = false;
      void fetchNewerBoard(BOARD_DAYS, cached.computedAt).then((newer) => {
        if (!stale && newer) applyBoard(newer);
      });

      return () => {
        stale = true;
      };
    }

    let cancelled = false;
    setBoardLoading(true);
    setBoardError("");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90_000);

    // Then the board last night's job left in the database, and only then
    // the engine — which sleeps, takes a minute to wake, and is what this
    // page used to wait for every single day.
    loadBoard(BOARD_DAYS, { signal: controller.signal })
      .then((data) => {
        if (!cancelled) applyBoard(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setBoardError(err.message);
      })
      .finally(() => {
        if (!cancelled) setBoardLoading(false);
        window.clearTimeout(timeout);
      });

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [enabled, applyBoard]);

  // Grouped by day first, then by league — matches inside each league stay in
  // the order the board already sorted them, chronologically by kickoff.
  const dayGroups = useMemo(() => {
    const groups = new Map<
      string,
      { short: string; long: string; items: BoardMatch[] }
    >();

    board.forEach((match) => {
      if (!match.kickoff) return;
      const date = new Date(match.kickoff);
      if (Number.isNaN(date.getTime())) return;
      const key = dayKey(date);
      if (!groups.has(key)) groups.set(key, { ...dayLabels(date), items: [] });
      groups.get(key)!.items.push(match);
    });

    return [...groups.values()];
  }, [board]);

  const currentDay = dayGroups[Math.min(activeDay, Math.max(dayGroups.length - 1, 0))];

  /** Of the day on screen, the ones the board's own record says to look at. */
  const curtos = useMemo(
    () => (currentDay ? shortlistOf(currentDay.items) : []),
    [currentDay],
  );

  const leagueGroups = useMemo(() => {
    if (!currentDay) return [];

    // Os dois filtros somam-se em vez de se substituírem: "a lista curta,
    // dos que eu marquei" é uma pergunta que faz sentido e não teria
    // resposta se ligar um desligasse o outro.
    const base = onlyShortlist ? curtos : currentDay.items;
    const items = onlyFavourites
      ? base.filter((match) => favoritos.has(match.fixture_id))
      : base;
    const groups = new Map<string, BoardMatch[]>();
    items.forEach((match) => {
      if (!groups.has(match.league)) groups.set(match.league, []);
      groups.get(match.league)!.push(match);
    });

    return [...groups.entries()].map(([league, items]) => ({ league, items }));
  }, [currentDay, curtos, onlyShortlist, onlyFavourites, favoritos]);

  /** Quantos dos jogos deste dia estão marcados. */
  const marcadosHoje = useMemo(
    () =>
      currentDay
        ? currentDay.items.filter((match) => favoritos.has(match.fixture_id))
            .length
        : 0,
    [currentDay, favoritos],
  );

  // Straight to the match's own page: the board already holds everything it
  // needs, so there is nothing to fetch and prefill on the way out.
  const openDeepDive = (match: BoardMatch) =>
    navigate(`/match/${match.fixture_id}`);

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLeagueChange = (league: string) => {
    const preset = LEAGUE_PRESET_MAP[league];
    setFormData((prev) => ({ ...prev, liga: league, ...(preset ?? {}) }));
  };

  const readyForStats =
    Number(formData.jogos_casa) > 0 && Number(formData.jogos_fora) > 0;

  const runManualProbability = async () => {
    setManualLoading(true);
    setManualError("");
    setManualResult(null);

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 90_000);

      const response = await fetch(buildApiUrl("/analyze/probabilities"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          equipa_casa: formData.equipa_casa || "Casa",
          equipa_fora: formData.equipa_fora || "Fora",
          liga: formData.liga,
          jogos_casa: Number(formData.jogos_casa),
          golos_marcados_casa: Number(formData.golos_marcados_casa),
          golos_sofridos_casa: Number(formData.golos_sofridos_casa),
          jogos_casa_rec: Number(formData.jogos_casa_rec),
          golos_marcados_casa_rec: Number(formData.golos_marcados_casa_rec),
          golos_sofridos_casa_rec: Number(formData.golos_sofridos_casa_rec),
          jogos_fora: Number(formData.jogos_fora),
          golos_marcados_fora: Number(formData.golos_marcados_fora),
          golos_sofridos_fora: Number(formData.golos_sofridos_fora),
          jogos_fora_rec: Number(formData.jogos_fora_rec),
          golos_marcados_fora_rec: Number(formData.golos_marcados_fora_rec),
          golos_sofridos_fora_rec: Number(formData.golos_sofridos_fora_rec),
          league_home_goals_avg: Number(formData.league_home_goals_avg),
          league_away_goals_avg: Number(formData.league_away_goals_avg),
          dixon_coles_rho: Number(formData.dixon_coles_rho),
          shrinkage_matches: Number(formData.shrinkage_matches),
        }),
      });
      window.clearTimeout(timeout);

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail?.[0]?.msg || data?.detail || "Falha ao calcular a probabilidade.");
      }

      setManualResult(data as ProbabilityResult);
    } catch (error) {
      console.error(error);
      setManualError(
        "Não foi possível contactar o motor de análise. Se estiver parado há algum tempo, pode demorar até um minuto a acordar — tenta novamente daqui a instantes."
      );
    } finally {
      setManualLoading(false);
    }
  };

  const continueManualToValueAnalysis = () => {
    navigate("/analysis", {
      state: {
        prefill: {
          liga: formData.liga,
          equipa_casa: formData.equipa_casa,
          equipa_fora: formData.equipa_fora,
          jogos_casa: formData.jogos_casa,
          golos_marcados_casa: formData.golos_marcados_casa,
          golos_sofridos_casa: formData.golos_sofridos_casa,
          jogos_casa_rec: formData.jogos_casa_rec,
          golos_marcados_casa_rec: formData.golos_marcados_casa_rec,
          golos_sofridos_casa_rec: formData.golos_sofridos_casa_rec,
          jogos_fora: formData.jogos_fora,
          golos_marcados_fora: formData.golos_marcados_fora,
          golos_sofridos_fora: formData.golos_sofridos_fora,
          jogos_fora_rec: formData.jogos_fora_rec,
          golos_marcados_fora_rec: formData.golos_marcados_fora_rec,
          golos_sofridos_fora_rec: formData.golos_sofridos_fora_rec,
          league_home_goals_avg: formData.league_home_goals_avg,
          league_away_goals_avg: formData.league_away_goals_avg,
        },
      },
    });
  };

  return (
    <AppLayout>
      {/* Puxar para baixo é o que toda a gente tenta antes de procurar um
          botão. O indicador aparece com o dedo e passa a verde quando já
          chega para largar. */}
      {pulled > 0 && (
        <div
          className="pointer-events-none fixed inset-x-0 top-14 z-40 flex justify-center"
          style={{ transform: `translateY(${Math.round(pulled)}px)` }}
          aria-hidden
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full bg-card shadow-md ring-1 ${
              pulled >= PULL_THRESHOLD
                ? "ring-[hsl(var(--sl-green))]/50 text-[hsl(var(--sl-green))]"
                : "ring-border text-muted-foreground"
            }`}
          >
            <RefreshCw
              className="h-4 w-4"
              style={{ transform: `rotate(${pulled * 3}deg)` }}
            />
          </span>
        </div>
      )}

      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-4 p-4 pt-0 sm:space-y-6 sm:p-5 sm:pt-0 md:p-6 md:pt-0"
      >
        {/* O título é para quem o ouve. Visível, dizia "Probabilidades"
            enquanto a barra de baixo dizia "Jogos" — dois nomes para o
            mesmo sítio — e a linha que explicava o quadro era um ensino
            de uma vez a ocupar o topo para sempre. O que interessa (de
            quando é o quadro, e o botão para o ir buscar outra vez) está
            logo abaixo, e os jogos começam no primeiro ecrã. */}
        <h1 className="sr-only">Probabilidades</h1>

        {enabled === null && (
          <motion.div
            variants={fadeUp}
            className="sl-card flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            A ligar ao motor de dados... pode demorar até um minuto se estiver
            parado há algum tempo.
          </motion.div>
        )}

        {/* Without this the page went silent when the engine did not answer:
            no board, no message, nothing to press. */}
        {enabled === false && (
          <motion.div variants={fadeUp} className="sl-card px-4 py-4">
            <p className="text-sm text-muted-foreground">
              O motor de dados não respondeu. Pode estar a arrancar — costuma
              demorar até um minuto quando esteve parado.
            </p>
            <SearchAgain loading={boardLoading} onClick={searchAgain} />
          </motion.div>
        )}

        {enabled === true && (
          <motion.div variants={fadeUp} className="space-y-4">
            {boardLoading && board.length === 0 && (
              <div className="space-y-2" aria-label="A carregar os jogos">
                <p className="sl-meta text-[11px]">
                  A calcular as probabilidades dos próximos 7 dias...
                </p>
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="sl-card flex items-center gap-3 px-4 py-3.5">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="sl-skeleton h-3.5 w-[55%]" />
                      <div className="sl-skeleton h-2.5 w-[28%]" />
                    </div>
                    <div className="space-y-1.5 text-right">
                      <div className="sl-skeleton ml-auto h-2.5 w-20" />
                      <div className="sl-skeleton ml-auto h-4 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {boardError && (
              <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-3">
                <p className="text-xs font-medium text-destructive">
                  {boardError}
                </p>
                <SearchAgain
                  loading={boardLoading}
                  onClick={() => void refreshBoard()}
                />
              </div>
            )}

            {/* The button belongs here, next to the sentence that sends
                someone looking for it. The icon up in the header is easy to
                miss and a long way from the only place on the page that says
                anything went wrong. */}
            {!boardLoading && !boardError && board.length === 0 && (
              <div className="sl-card px-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Sem jogos analisáveis nos próximos dias nas ligas com dados
                  automáticos. Pode ser só a fonte de dados a não responder
                  agora — procura outra vez.
                </p>
                <SearchAgain
                  loading={boardLoading}
                  onClick={() => void refreshBoard()}
                />
              </div>
            )}

            {/* Above the days, where somebody who notices a missing
                competition is already looking. */}
            {board.length > 0 && (
              <BoardRefresh
                at={boardAt}
                games={board.length}
                missing={unavailableLeagues}
                loading={boardLoading}
                note={refreshNote}
                onClick={() => void refreshBoard()}
              />
            )}

            {(dayGroups.length > 0 || !hits.loading) && (
                <>
                  <div className="sl-scroll-x -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                    {/* The day before, in the same row as the days after.
                        It is the one day on this page with an answer rather
                        than a forecast, and it belongs where somebody is
                        already tapping. */}
                    <button
                      type="button"
                      data-active={yesterdayOpen}
                      onClick={() => setYesterdayOpen(true)}
                      className="sl-chip flex-none"
                    >
                      Ontem
                      {hits.yesterday.length > 0 && (
                        <span className="text-[11px] opacity-65">
                          {hits.yesterday.length}
                        </span>
                      )}
                    </button>

                    {dayGroups.map((day, index) => {
                      const isActive =
                        !yesterdayOpen &&
                        index === Math.min(activeDay, dayGroups.length - 1);
                      return (
                        <button
                          key={day.long}
                          type="button"
                          data-active={isActive}
                          onClick={() => {
                            setYesterdayOpen(false);
                            setActiveDay(index);
                          }}
                          className="sl-chip flex-none capitalize"
                        >
                          {day.short}
                          <span className="text-[11px] opacity-65">
                            {day.items.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* O dia lido pelo registo do próprio quadro: dupla
                      hipótese acima de 70%, que em 102 jogos já jogados e
                      medidos outra vez entrou 87,5% das vezes. O resto do
                      que o quadro destaca — golos, ambas marcam,
                      combinados — entrou 53%, que é pouco mais do que uma
                      moeda ao ar. */}
                  {/* Dois filtros, dois chips, na mesma fila dos dias: era
                      um cartão inteiro para um deles, e dois cartões para os
                      dois teriam empurrado os jogos para fora do ecrã outra
                      vez. A explicação de cada um só se lê quando está
                      ligado. */}
                  {!yesterdayOpen && (
                    <>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setOnlyShortlist((only) => !only)}
                          aria-pressed={onlyShortlist}
                          data-active={onlyShortlist}
                          className="sl-chip sl-tap"
                        >
                          <ListFilter className="h-3.5 w-3.5 flex-none" />
                          Lista curta
                          <span className="text-[11px] opacity-65">
                            {curtos.length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setOnlyFavourites((only) => !only)}
                          aria-pressed={onlyFavourites}
                          data-active={onlyFavourites}
                          disabled={marcadosHoje === 0 && !onlyFavourites}
                          className="sl-chip sl-tap disabled:opacity-45"
                        >
                          <Star
                            className="h-3.5 w-3.5 flex-none"
                            fill={onlyFavourites ? "currentColor" : "none"}
                          />
                          Favoritos
                          <span className="text-[11px] opacity-65">
                            {marcadosHoje}
                          </span>
                        </button>
                      </div>

                      {onlyShortlist && (
                        <p className="sl-meta mt-1.5 px-0.5 text-[11px] leading-[1.5]">
                          Dupla hipótese a {SHORTLIST_MIN_PCT}%+ · entraram 87%
                          · o resto 53%
                        </p>
                      )}
                    </>
                  )}

                  {yesterdayOpen ? (
                    <div className="mt-4">
                      <RecentHits state={hits} />
                    </div>
                  ) : onlyFavourites && leagueGroups.length === 0 ? (
                    <p className="sl-card mt-4 px-4 py-4 text-[12.5px] leading-[1.5] text-muted-foreground">
                      {marcadosHoje === 0
                        ? "Ainda não marcaste nenhum jogo deste dia. A estrela ao lado de cada um guarda-o aqui."
                        : "Nenhum dos que marcaste está também na lista curta."}
                    </p>
                  ) : onlyShortlist && curtos.length === 0 ? (
                    <p className="sl-card mt-4 px-4 py-4 text-[12.5px] leading-[1.5] text-muted-foreground">
                      Hoje não há nenhum jogo na lista curta. É um dia para
                      não apostar — o que também é uma decisão.
                    </p>
                  ) : (
                  <div className="mt-4 space-y-5">
                    {leagueGroups.map(({ league, items }) => (
                      <div key={league} className="space-y-2">
                        {/* O mesmo cabeçalho que todas as outras secções da
                            aplicação têm, em vez de um rótulo em
                            maiúsculas que era um estilo só dele. */}
                        <h2 className="sl-sec-title px-0.5">
                          {league}
                          <span className="sl-pill sl-pill-muted text-[11px]">
                            {items.length}
                          </span>
                        </h2>
                        <div className="space-y-2">
                          {items.map((match) => (
                            <BoardMatchRow
                              key={match.fixture_id}
                              match={match}
                              tips={matchTips(
                                match.mercados,
                                rates.get(match.league),
                              )}
                              isExpanded={expandedId === match.fixture_id}
                              onToggle={() =>
                                setExpandedId(
                                  expandedId === match.fixture_id
                                    ? null
                                    : match.fixture_id
                                )
                              }
                              onContinue={() => openDeepDive(match)}
                              favourite={favoritos.has(match.fixture_id)}
                              onFavourite={() =>
                                favoritos.toggle(match.fixture_id)
                              }
                              onAddToChallenge={
                                aDecorrer.length > 0
                                  ? (market, pct) =>
                                      juntarAoDesafio(match, market, pct)
                                  : undefined
                              }
                              verdict={marcados.get(match.fixture_id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  )}
                </>
              )}

              {/* The competitions that did not answer used to be named here
                  too. They are now on the card with the button, which is
                  the only place where knowing it leads anywhere. */}
              {skippedCount > 0 && (
                <p className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground">
                  <ListFilter className="mt-0.5 h-3 w-3 flex-none" />
                  <span>
                    {`${skippedCount} jogo${skippedCount === 1 ? "" : "s"} sem histórico suficiente ficaram de fora.`}
                  </span>
                </p>
              )}
          </motion.div>
        )}

        <motion.div variants={fadeUp} className="sl-card">
          <button
            type="button"
            onClick={() => setInfoOpen((open) => !open)}
            className="flex w-full items-center gap-3 p-4 text-left"
          >
            <Info className="h-4 w-4 flex-none text-primary" strokeWidth={2} />
            <p className="flex-1 text-[13px] font-semibold text-foreground">
              O que o registo diz
            </p>
            <ChevronDown
              className={`h-4 w-4 flex-none text-muted-foreground transition-transform ${infoOpen ? "rotate-180" : ""}`}
            />
          </button>
          <AnimatePresence initial={false}>
            {infoOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {/* Isto eram três conselhos genéricos, e um deles — fugir
                    da amostra "Baixa" — foi medido e não é verdade: a alta
                    acertou 52,6% e a baixa 65,1%. Ficam os três números que
                    o registo do próprio quadro dá. */}
                <dl className="space-y-1.5 px-4 pb-4 text-xs">
                  {[
                    ["Dupla hipótese a 70%+", "entrou 87% das vezes"],
                    ["Golos, ambas marcam, combinados", "53%, moeda ao ar"],
                    ["Qualquer escolha", "só paga acima da odd mínima da linha"],
                  ].map(([what, said]) => (
                    <div key={what} className="flex items-baseline gap-2">
                      <dt className="min-w-0 flex-1 text-muted-foreground">
                        {what}
                      </dt>
                      <dd className="flex-none font-semibold text-foreground">
                        {said}
                      </dd>
                    </div>
                  ))}
                </dl>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div variants={fadeUp}>
          <button
            type="button"
            onClick={() => setManualOpen((open) => !open)}
            className="sl-card flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <span className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-muted-foreground" />
              Análise manual
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${manualOpen ? "rotate-180" : ""}`}
            />
          </button>
        </motion.div>

        <AnimatePresence initial={false}>
          {manualOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
                <div className="space-y-6">
                  <SectionCard title="Jogo">
                    <div className="space-y-4">
                      <TodayMatches
                        onSelect={(league, values) => {
                          setFormData((prev) => ({
                            ...prev,
                            liga: league,
                            ...(LEAGUE_PRESET_MAP[league] ?? {}),
                            ...values,
                          }));
                        }}
                      />

                      <SelectField
                        label="Competição"
                        value={formData.liga}
                        onChange={handleLeagueChange}
                        options={[...LEAGUE_PRESETS]
                          .sort((a, b) => `${a.country} ${a.label}`.localeCompare(`${b.country} ${b.label}`))
                          .map((preset) => ({
                            value: preset.key,
                            label: `${preset.country} · ${preset.label}`,
                          }))}
                      />

                      <LeagueCalibration
                        league={formData.liga}
                        onCalibrate={(values) =>
                          setFormData((prev) => ({ ...prev, ...values }))
                        }
                      />

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FormField
                          label="Equipa da Casa"
                          value={formData.equipa_casa}
                          onChange={(v) => updateField("equipa_casa", v)}
                        />
                        <FormField
                          label="Equipa de Fora"
                          value={formData.equipa_fora}
                          onChange={(v) => updateField("equipa_fora", v)}
                        />
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title="Estatísticas — Casa">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <FormField label="Jogos" value={formData.jogos_casa} onChange={(v) => updateField("jogos_casa", v)} type="number" />
                      <FormField label="Golos Marcados" value={formData.golos_marcados_casa} onChange={(v) => updateField("golos_marcados_casa", v)} type="number" />
                      <FormField label="Golos Sofridos" value={formData.golos_sofridos_casa} onChange={(v) => updateField("golos_sofridos_casa", v)} type="number" />
                      <FormField label="Jogos Recentes" value={formData.jogos_casa_rec} onChange={(v) => updateField("jogos_casa_rec", v)} type="number" />
                      <FormField label="Marcados (Rec.)" value={formData.golos_marcados_casa_rec} onChange={(v) => updateField("golos_marcados_casa_rec", v)} type="number" />
                      <FormField label="Sofridos (Rec.)" value={formData.golos_sofridos_casa_rec} onChange={(v) => updateField("golos_sofridos_casa_rec", v)} type="number" />
                    </div>
                  </SectionCard>

                  <SectionCard title="Estatísticas — Fora">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <FormField label="Jogos" value={formData.jogos_fora} onChange={(v) => updateField("jogos_fora", v)} type="number" />
                      <FormField label="Golos Marcados" value={formData.golos_marcados_fora} onChange={(v) => updateField("golos_marcados_fora", v)} type="number" />
                      <FormField label="Golos Sofridos" value={formData.golos_sofridos_fora} onChange={(v) => updateField("golos_sofridos_fora", v)} type="number" />
                      <FormField label="Jogos Recentes" value={formData.jogos_fora_rec} onChange={(v) => updateField("jogos_fora_rec", v)} type="number" />
                      <FormField label="Marcados (Rec.)" value={formData.golos_marcados_fora_rec} onChange={(v) => updateField("golos_marcados_fora_rec", v)} type="number" />
                      <FormField label="Sofridos (Rec.)" value={formData.golos_sofridos_fora_rec} onChange={(v) => updateField("golos_sofridos_fora_rec", v)} type="number" />
                    </div>
                  </SectionCard>

                  <Button
                    size="lg"
                    className="h-12 w-full rounded-2xl text-sm font-semibold"
                    disabled={manualLoading || !readyForStats}
                    onClick={runManualProbability}
                  >
                    {manualLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> A calcular...
                      </span>
                    ) : (
                      "Ver Probabilidade"
                    )}
                  </Button>
                  {!readyForStats && (
                    <p className="-mt-3 text-center text-[11px] text-muted-foreground">
                      Escolhe um jogo em "Jogos do Dia" ou preenche os jogos disputados de cada equipa.
                    </p>
                  )}
                  {manualError && (
                    <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
                      {manualError}
                    </p>
                  )}
                </div>

                <div className="lg:sticky lg:top-6 lg:self-start">
                  <SectionCard title={manualResult ? `${formData.equipa_casa || "Casa"} vs ${formData.equipa_fora || "Fora"}` : "Resultado"}>
                    {manualResult ? (
                      <div className="space-y-5">
                        <ProbabilityBreakdown data={manualResult} />
                        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Tens as odds do teu bookmaker? Continua para a Análise de
                            Valor para veres o edge, a classificação do mercado e a
                            stake sugerida pelo critério de Kelly.
                          </p>
                          <Button
                            variant="outline"
                            className="mt-3 h-10 w-full gap-2 rounded-xl border-cyan-400/30 text-xs text-cyan-100 hover:bg-cyan-400/10"
                            onClick={continueManualToValueAnalysis}
                          >
                            Continuar para Análise de Valor
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Preenche as estatísticas das duas equipas e carrega em "Ver
                        Probabilidade" para veres a leitura do modelo, sem precisares
                        de nenhuma odd.
                      </p>
                    )}
                  </SectionCard>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Com mais do que um desafio a decorrer, pergunta-se qual. Cada
          linha diz em que nível está e quanto esse nível pede, porque é
          isso que decide para onde o jogo vai. */}
      <Dialog
        open={aEscolherDesafio !== null}
        onOpenChange={(open) => !open && setAEscolherDesafio(null)}
      >
        <DialogContent className="gap-0 p-0 sm:max-w-sm">
          <DialogHeader className="border-b border-border px-4 py-3 text-left">
            <DialogTitle className="text-sm font-bold">
              Para que desafio?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 p-3">
            {aDecorrer.map((entry) => (
              <button
                key={entry.plan.id}
                type="button"
                onClick={() =>
                  aEscolherDesafio &&
                  levarParaODesafio(entry.plan.id, aEscolherDesafio)
                }
                className="sl-tap flex w-full items-center gap-3 rounded-xl bg-card px-3.5 py-3 text-left ring-1 ring-border transition-colors hover:ring-primary/45"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-foreground">
                    {entry.plan.name}
                  </span>
                  <span className="sl-meta block text-[11px]">
                    Nível {entry.standing.day} de {entry.plan.days} ·{" "}
                    {eur.format(entry.standing.bankroll)}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 flex-none text-muted-foreground" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
