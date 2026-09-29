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
        Dia {point.step} · {when(point.at)} ·{" "}
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
  const points = bankrollTrend(startingBankroll, bets);

  // Two points are the shortest line worth drawing; one is a dot pretending
  // to be a trend.
  if (points.length < 2) return null;

  const { low, high } = trendRange(points, startingBankroll);
  const last = points[points.length - 1];
  const moved = last.bankroll - startingBankroll;

  return (
    <section className="sl-card overflow-hidden">
      <div className="flex items-end justify-between gap-3 px-4 pb-1 pt-3.5">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-foreground">
            A banca, dia a dia
          </h2>
          <p className="sl-meta text-[11px]">
            {points.length} dias fechados, desde{" "}
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

      <div className="h-[132px] w-full px-1 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="sl-trend" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0.22}
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke="hsl(var(--border))"
              strokeDasharray="3 3"
            />
            <YAxis domain={[low, high]} hide />
            <Tooltip
              content={<Detail />}
              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="bankroll"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#sl-trend)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
