import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Info, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { SectionCard, FormField, SelectField } from "@/components/AnalysisFormControls";
import { TodayMatches } from "@/components/TodayMatches";
import { LeagueCalibration } from "@/components/LeagueCalibration";
import {
  ProbabilityBreakdown,
  type ProbabilityResult,
} from "@/components/ProbabilityBreakdown";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/apiConfig";
import {
  DEFAULT_LEAGUE_KEY,
  LEAGUE_PRESETS,
  LEAGUE_PRESET_MAP,
} from "@/lib/leaguePresets";
import type { AnalysisFixture } from "@/types/analysis";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

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

/**
 * The odds-free half of an analysis: what the model thinks will happen,
 * before ever looking at a bookmaker's price. This never becomes a bet on
 * its own — for value, stake and a decision, the same data continues into
 * Match Analysis once real odds are on the table.
 */
export default function ProbabilityRadar() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [result, setResult] = useState<ProbabilityResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLeagueChange = (league: string) => {
    const preset = LEAGUE_PRESET_MAP[league];
    setFormData((prev) => ({ ...prev, liga: league, ...(preset ?? {}) }));
  };

  const readyForStats =
    Number(formData.jogos_casa) > 0 && Number(formData.jogos_fora) > 0;

  const runProbability = async () => {
    setIsLoading(true);
    setErrorMessage("");
    setResult(null);

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

      setResult(data as ProbabilityResult);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Não foi possível contactar o motor de análise. Se estiver parado há algum tempo, pode demorar até um minuto a acordar — tenta novamente daqui a instantes."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const continueToValueAnalysis = () => {
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
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-6 p-4 sm:p-5 md:p-6"
      >
        <motion.div
          variants={fadeUp}
          className="relative overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.1),transparent_28%)]" />
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
              Probabilidade
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Qual é a probabilidade real deste jogo?
            </h1>
            <p className="mt-2 text-sm leading-7 text-white/60">
              Sem odds, sem valor, sem stake — só o que o modelo espera que
              aconteça. Compara isto com o preço do teu bookmaker mais tarde,
              na Análise de Valor.
            </p>
          </div>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4"
        >
          <Info className="mt-0.5 h-4 w-4 flex-none text-cyan-300" strokeWidth={1.7} />
          <div className="text-xs leading-relaxed text-white/55">
            <p className="font-semibold text-white/75">Como usar isto de forma profissional</p>
            <p className="mt-1">
              1. Vê a probabilidade real aqui, antes de olhar para qualquer odd. 2. Compara com o preço do
              bookmaker — só há valor quando a tua probabilidade é claramente maior do que a implícita na odd.
              3. Aposta pouco por jogo (uma fração pequena da banca, nunca "tudo ou nada") e só em mercados
              onde a amostra é sólida.
            </p>
          </div>
        </motion.div>

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
              disabled={isLoading || !readyForStats}
              onClick={runProbability}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> A calcular...
                </span>
              ) : (
                "Ver Probabilidade"
              )}
            </Button>
            {!readyForStats && (
              <p className="-mt-3 text-center text-[11px] text-white/40">
                Escolhe um jogo em "Jogos do Dia" ou preenche os jogos disputados de cada equipa.
              </p>
            )}
            {errorMessage && (
              <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
                {errorMessage}
              </p>
            )}
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <SectionCard title={result ? `${formData.equipa_casa || "Casa"} vs ${formData.equipa_fora || "Fora"}` : "Resultado"}>
              {result ? (
                <div className="space-y-5">
                  <ProbabilityBreakdown data={result} />
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                    <p className="text-xs leading-relaxed text-white/60">
                      Tens as odds do teu bookmaker? Continua para a Análise de
                      Valor para veres o edge, a classificação do mercado e a
                      stake sugerida pelo critério de Kelly.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-3 h-10 w-full gap-2 rounded-xl border-cyan-400/30 text-xs text-cyan-100 hover:bg-cyan-400/10"
                      onClick={continueToValueAnalysis}
                    >
                      Continuar para Análise de Valor
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-white/45">
                  Preenche as estatísticas das duas equipas e carrega em "Ver
                  Probabilidade" para veres a leitura do modelo, sem precisares
                  de nenhuma odd.
                </p>
              )}
            </SectionCard>
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
}
