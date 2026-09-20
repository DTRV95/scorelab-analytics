import { useMemo, useState } from "react";
import { Layers3 } from "lucide-react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { Button } from "@/components/ui/button";
import { calculateNextBankrollBefore, saveAnalysis } from "@/lib/analysisStorage";
import {
  buildBetFromBoard,
  buildLegFromBoard,
  edgeFor,
  suggestStake,
} from "@/lib/betFromBoard";
import { addLegToMultipleDraft } from "@/lib/multipleStorage";
import type { BoardMatch } from "@/lib/probabilityBoardCache";

/**
 * Turns a forecast into a tracked bet: pick the
 * market, type the price your book is offering, done. The edge updates as you
 * type so you can see whether the price is worth taking before committing.
 */
export function PlaceBetForm({ match }: { match: BoardMatch }) {
  // Same bankroll reading the manual analysis flow stakes against, so a bet
  // placed here and one placed there start from the same number.
  const bankroll = useMemo(() => calculateNextBankrollBefore(), []);

  const [market, setMarket] = useState(match.headline_market);
  const [odds, setOdds] = useState("");
  const [stake, setStake] = useState("");
  const [saved, setSaved] = useState(false);
  // Keyed by what was added, so changing the market or the price offers the
  // button again instead of leaving a stale "added" state on a new selection.
  const [addedKey, setAddedKey] = useState<string | null>(null);

  const modelProb =
    match.mercados.find((m) => m.mercado === market)?.probabilidade_pct ?? 0;
  const oddsValue = Number(odds.replace(",", "."));
  const hasOdds = Number.isFinite(oddsValue) && oddsValue > 1;
  const edge = hasOdds ? edgeFor(modelProb, oddsValue) : null;
  const suggested = hasOdds ? suggestStake(modelProb, oddsValue, bankroll) : 0;
  const stakeValue = Number(stake.replace(",", "."));
  const hasStake = Number.isFinite(stakeValue) && stakeValue > 0;

  const place = () => {
    if (!hasOdds || !hasStake) return;
    saveAnalysis(
      buildBetFromBoard({
        match,
        market,
        odds: oddsValue,
        stake: stakeValue,
        bankroll,
      })
    );
    setSaved(true);
  };

  const slipKey = `${market}@${oddsValue}`;
  const addedToSlip = addedKey === slipKey;

  const addToSlip = () => {
    if (!hasOdds) return;
    addLegToMultipleDraft(buildLegFromBoard({ match, market, odds: oddsValue }));
    setAddedKey(slipKey);
  };

  if (saved) {
    return (
      <div className="rounded-xl border border-[hsl(var(--sl-green))]/30 bg-[hsl(var(--sl-green))]/5 p-3.5">
        <p className="text-sm font-semibold text-[hsl(var(--sl-green))]">
          Aposta registada.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Fica em "Apostas" como pendente. O resultado final é obtido pela API
          e a aposta é fechada como green ou red sem teres de fazer nada.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <p className="text-[13px] font-semibold text-foreground">
        Registar aposta neste jogo
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Escolhe o mercado e mete a odd da tua casa. O resultado é fechado
        automaticamente quando o jogo acabar.
      </p>

      <div className="mt-3 space-y-2">
        <select
          value={market}
          onChange={(e) => setMarket(e.target.value)}
          style={{ colorScheme: "light" }}
          className="h-10 w-full rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {match.mercados.map((m) => (
            <option key={m.mercado} value={m.mercado}>
              {(MARKET_LABELS[m.mercado] ?? m.mercado) +
                ` — ${m.probabilidade_pct.toFixed(1)}%`}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="sl-meta text-[11px]">Odd</span>
            <input
              inputMode="decimal"
              value={odds}
              onChange={(e) => setOdds(e.target.value)}
              placeholder="1.85"
              className="mt-1 h-10 w-full rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 font-mono-data text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="block">
            <span className="sl-meta text-[11px]">Stake (€)</span>
            <input
              inputMode="decimal"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              placeholder={suggested > 0 ? suggested.toFixed(2) : "10"}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 font-mono-data text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        {edge !== null && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 py-2">
            <span className="sl-meta text-[11px]">
              Modelo {modelProb.toFixed(1)}% vs odd {(100 / oddsValue).toFixed(1)}%
            </span>
            <span
              className={`font-mono-data text-sm font-bold ${
                edge > 0 ? "text-[hsl(var(--sl-green))]" : "text-destructive"
              }`}
            >
              {edge > 0 ? "+" : ""}
              {edge.toFixed(1)}%
            </span>
          </div>
        )}

        {edge !== null && edge <= 0 && (
          <p className="text-xs leading-relaxed text-destructive">
            A esta odd o mercado está a pagar menos do que o modelo acha justo.
            Podes registar na mesma, mas sem valor a teu favor.
          </p>
        )}

        {suggested > 0 && (
          <button
            type="button"
            onClick={() => setStake(suggested.toFixed(2))}
            className="text-[12px] font-semibold text-primary"
          >
            Usar stake sugerida ({suggested.toFixed(2)} €)
          </button>
        )}

        <Button
          className="sl-btn-primary h-10 w-full text-xs disabled:opacity-40"
          disabled={!hasOdds || !hasStake}
          onClick={place}
        >
          Registar aposta
        </Button>

        {/* The multiple takes no stake here on purpose: the stake belongs to
            the whole slip, not to one leg, and is typed once in the betslip. */}
        <button
          type="button"
          disabled={!hasOdds || addedToSlip}
          onClick={addToSlip}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-primary/40 text-xs font-semibold text-primary transition disabled:opacity-40"
        >
          <Layers3 className="h-3.5 w-3.5" strokeWidth={2.1} />
          {addedToSlip ? "Na múltipla" : "Adicionar à múltipla"}
        </button>

        {addedToSlip && (
          <p className="sl-meta text-center text-[11px]">
            Abre a múltipla no canto do ecrã para meter a stake.
          </p>
        )}
      </div>
    </div>
  );
}
