import { motion } from "framer-motion";

export interface ProbabilityMarket {
  mercado: string;
  grupo: string;
  probabilidade_pct: number;
  min_pct: number;
  max_pct: number;
}

export interface ProbabilityResult {
  lambda_casa: number;
  lambda_fora: number;
  total_golos_esperados: number;
  amostra_pct: number;
  amostra_label: string;
  mercados: ProbabilityMarket[];
}

export const MARKET_LABELS: Record<string, string> = {
  Casa: "Vitória Casa",
  Empate: "Empate",
  Fora: "Vitória Fora",
  "1X": "Casa ou Empate (1X)",
  "2X": "Fora ou Empate (2X)",
  "Mais de 2.5 Golos": "Mais de 2.5 Golos",
  "Menos de 2.5 Golos": "Menos de 2.5 Golos",
  "Mais de 3.5 Golos": "Mais de 3.5 Golos",
  "Menos de 3.5 Golos": "Menos de 3.5 Golos",
  "Ambas Marcam": "Ambas Marcam",
  "BTTS No": "Ambas Não Marcam",
  "1X e Menos de 3.5 Golos": "1X e Menos de 3.5 Golos",
  "2X e Menos de 3.5 Golos": "2X e Menos de 3.5 Golos",
  "1X e Mais de 1.5 Golos": "1X e Mais de 1.5 Golos",
  "2X e Mais de 1.5 Golos": "2X e Mais de 1.5 Golos",
};

const GROUP_ORDER = ["Resultado", "Golos", "Ambas Marcam", "Combinados"];

function barTone(pct: number) {
  if (pct >= 60) return "bg-emerald-400";
  if (pct >= 40) return "bg-cyan-400";
  return "bg-white/25";
}

export function sampleTone(label: string) {
  if (label === "Alta") return "text-emerald-300 bg-emerald-400/10 ring-emerald-400/20";
  if (label === "Média") return "text-amber-300 bg-amber-400/10 ring-amber-400/20";
  return "text-rose-300 bg-rose-400/10 ring-rose-400/20";
}

/**
 * Pure model probability, grouped and ranked — deliberately with no odds, no
 * edge and no stake anywhere on it. Comparing this against a bookmaker's
 * price is a separate, later step.
 */
export function ProbabilityBreakdown({ data }: { data: ProbabilityResult }) {
  const groups = GROUP_ORDER.map((grupo) => ({
    grupo,
    mercados: data.mercados
      .filter((m) => m.grupo === grupo)
      .sort((a, b) => b.probabilidade_pct - a.probabilidade_pct),
  })).filter((group) => group.mercados.length > 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/38">
            xG Casa
          </p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-white">
            {data.lambda_casa.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/38">
            xG Fora
          </p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-white">
            {data.lambda_fora.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/38">
            Total Esperado
          </p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-white">
            {data.total_golos_esperados.toFixed(2)}
          </p>
        </div>
      </div>

      <div
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium ring-1 ${sampleTone(
          data.amostra_label
        )}`}
      >
        Confiança da amostra: {data.amostra_label} ({data.amostra_pct.toFixed(0)}%)
      </div>

      {groups.map((group) => (
        <div key={group.grupo} className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/38">
            {group.grupo}
          </p>
          <div className="space-y-2">
            {group.mercados.map((market) => (
              <div
                key={market.mercado}
                className="rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-white">
                    {MARKET_LABELS[market.mercado] ?? market.mercado}
                  </span>
                  <span className="font-mono text-sm font-semibold text-white">
                    {market.probabilidade_pct.toFixed(1)}%
                  </span>
                </div>
                <div className="relative mt-2.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${market.probabilidade_pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`absolute inset-y-0 left-0 rounded-full ${barTone(
                      market.probabilidade_pct
                    )}`}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-white/40">
                  Intervalo plausível: {market.min_pct.toFixed(0)}% – {market.max_pct.toFixed(0)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
