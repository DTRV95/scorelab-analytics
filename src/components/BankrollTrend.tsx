import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import { bankrollTrend, trendRange, type TrendPoint } from "@/lib/bankrollTrend";
import type { PlanBet } from "@/lib/planStore";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

/** One point, read out in words rather than left to the axis. */
function Detail({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TrendPoint }[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-xl bg-card px-3 py-2 shadow-lg ring-1 ring-border">
      <p className="sl-figure text-[13px] text-foreground">
        {eur.format(point.bankroll)}
      </p>
      <p className="sl-meta text-[11px]">
        {point.step === 0 ? "No início" : `Nível ${point.step}`} ·{" "}
        {when(point.at)} ·{" "}
        <span
          className={
            point.change >= 0
              ? "text-[hsl(var(--sl-green))]"
              : "text-destructive"
          }
        >
          {point.change >= 0 ? "+" : ""}
          {eur.format(point.change)}
        </span>
      </p>
    </div>
  );
}

/**
 * Só os pontos que são mesmo números.
 *
 * Uma banca por somar — uma linha de dados em falta, um campo vazio — dá
 * NaN, e o gráfico desenhava na mesma: a grelha tracejada e um buraco
 * branco do tamanho dela, que se lê como coisa partida. Sem pontos
 * desenháveis não há gráfico nenhum, que é a resposta honesta.
 */
function drawable<T extends { bankroll: number }>(points: T[]): T[] {
  return points.filter((point) => Number.isFinite(point.bankroll));
}

/**
 * The line itself, without a card around it.
 *
 * Apart from the card so that the home page can put it under the bankroll it
 * belongs to, instead of drawing the same money twice on the same screen.
 */
export function TrendChart({
  startingBankroll,
  bets,
  height = 132,
  onDark = false,
}: {
  startingBankroll: number;
  bets: PlanBet[];
  height?: number;
  /** Desenhada por cima do marcador escuro, e não de um cartão branco. */
  onDark?: boolean;
}) {
  const points = drawable(bankrollTrend(startingBankroll, bets));

  // Two points are the shortest line worth drawing; one is a dot pretending
  // to be a trend.
  if (points.length < 2) return null;

  const { low, high } = trendRange(points, startingBankroll);

  // A linha e a grelha mudam com o chão: a grelha cinzenta clara do papel,
  // posta sobre azul-noite, era mais clara do que o próprio azul.
  const linha = onDark ? "hsl(22 100% 58%)" : "hsl(var(--primary))";
  const grelha = onDark ? "hsla(0, 0%, 100%, 0.09)" : "hsl(var(--border))";

  return (
    <div className="w-full px-1 pb-2" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="sl-trend" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={linha}
                  stopOpacity={onDark ? 0.34 : 0.22}
                />
                <stop
                  offset="100%"
                  stopColor={linha}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke={grelha}
              strokeDasharray="3 3"
            />
            <YAxis domain={[low, high]} hide />
            <Tooltip
              content={<Detail />}
              cursor={{ stroke: grelha, strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="bankroll"
              stroke={linha}
              strokeWidth={2.25}
              fill="url(#sl-trend)"
              dot={false}
              activeDot={{
                r: 4,
                strokeWidth: 2,
                stroke: onDark ? "hsl(var(--sl-nav))" : "hsl(var(--card))",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
    </div>
  );
}

/**
 * The line the betting drew.
 *
 * One series, so no legend: the heading names it. Days still open are not on
 * it and neither is money put into the bankroll — both would draw the line
 * somewhere it has not actually been.
 */
export function BankrollTrend({
  startingBankroll,
  bets,
}: {
  startingBankroll: number;
  bets: PlanBet[];
}) {
  const points = drawable(bankrollTrend(startingBankroll, bets));
  if (points.length < 2) return null;

  const moved = points[points.length - 1].bankroll - startingBankroll;

  return (
    <section className="sl-card overflow-hidden">
      <div className="flex items-end justify-between gap-3 px-4 pb-1 pt-3.5">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-foreground">
            A banca, nível a nível
          </h2>
          <p className="sl-meta text-[11px]">
            {points.length} níveis fechados, desde{" "}
            {eur.format(startingBankroll)}
          </p>
        </div>
        <p
          className={`sl-figure flex-none text-[17px] ${
            moved >= 0 ? "text-[hsl(var(--sl-green))]" : "text-destructive"
          }`}
        >
          {moved >= 0 ? "+" : ""}
          {eur.format(moved)}
        </p>
      </div>

      <TrendChart startingBankroll={startingBankroll} bets={bets} />
    </section>
  );
}
