import { supabase } from "@/lib/supabaseClient";
import type { Call, Suggestion } from "@/lib/suggestion";

/**
 * O registo das sugestões: o que se disse, ao preço do dia, antes de se
 * saber o resultado.
 *
 * Toda a gente dá palpites sobre futebol e ninguém os conta. É isto que
 * separa esta casa de um site de prognósticos: o que aqui se diz fica
 * escrito com o preço a que foi dito, e daqui a um mês sabe-se se valeu
 * alguma coisa — incluindo se não valeu.
 *
 * Guarda-se a primeira e mais nenhuma. A tabela não tem sequer política
 * de UPDATE: um palpite que se corrige depois do jogo não é um palpite,
 * é uma recordação.
 */

export interface SuggestionRow {
  fixture_id: number;
  mercado: string;
  league: string | null;
  kickoff: string | null;
  call: string;
  fair_pct: number | null;
  price: number | null;
  edge_pp: number | null;
  required_pp: number | null;
  derived: boolean | null;
  because: string | null;
  decided_at: string;
  /** O que o jogo fez a este mercado. Null enquanto não for conferido. */
  landed?: boolean | null;
}

export async function keepSuggestion(
  fixtureId: number,
  league: string,
  kickoff: string | null,
  suggestion: Suggestion,
): Promise<void> {
  // Sem mercado nomeado ou sem preço não há nada que se possa conferir
  // depois: a decisão dependeria de um número que não existia.
  const pick = suggestion.pick;
  if (!pick || pick.price === null) return;
  if (!supabase) return;

  // ignoreDuplicates: a primeira fica. Se alguém abrir o mesmo jogo
  // amanhã, com outro preço, isso não pode reescrever o que se disse
  // hoje.
  await supabase.from("verdict_record").upsert(
    {
      fixture_id: fixtureId,
      mercado: pick.market,
      league,
      kickoff,
      fonte: "sugestao",
      call: suggestion.call,
      fair_pct: pick.ours,
      price: pick.price,
      edge_pp: pick.edge,
      required_pp: suggestion.required,
      derived: pick.derived,
      because: suggestion.because,
    },
    { onConflict: "fixture_id,mercado", ignoreDuplicates: true },
  );
}

export interface Tally {
  /** Quantas já foram conferidas. */
  settled: number;
  /** Destas, quantas entraram. */
  landed: number;
  winPct: number | null;
  /**
   * O que teria dado segui-las, a uma unidade cada e ao preço
   * registado. É o número que interessa — acertar muito a preços maus
   * não é ganhar.
   */
  unitsProfit: number | null;
  roi: number | null;
}

/**
 * O que uma decisão destas tem valido.
 *
 * O "não punha" conta ao contrário de propósito: ali acertar é o
 * mercado **não** entrar, e é isso que a conta mede. Uma casa que só
 * contasse os acertos das apostas que fez estaria a esconder metade do
 * seu trabalho, que é o de dizer que não.
 */
export function tally(rows: SuggestionRow[], call: Call): Tally {
  const mine = rows.filter(
    (row) => row.call === call && typeof row.landed === "boolean",
  );
  const certo = (row: SuggestionRow) =>
    call === "passar" ? !row.landed : Boolean(row.landed);

  const landed = mine.filter(certo).length;
  const profit = mine.reduce(
    (total, row) => total + (row.landed ? (row.price ?? 1) - 1 : -1),
    0,
  );

  return {
    settled: mine.length,
    landed,
    winPct: mine.length ? Number(((landed / mine.length) * 100).toFixed(1)) : null,
    unitsProfit: mine.length ? Number(profit.toFixed(2)) : null,
    roi: mine.length ? Number(((profit / mine.length) * 100).toFixed(1)) : null,
  };
}

export async function fetchScoredSuggestions(): Promise<SuggestionRow[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("suggestion_scored")
    .select("*")
    .order("kickoff", { ascending: false })
    .limit(500);

  if (error) return [];
  return (data ?? []) as SuggestionRow[];
}
