import { supabase } from "@/lib/supabaseClient";
import type { Verdict } from "@/lib/verdict";

/**
 * O registo dos veredictos: o que dissemos, ao preço do dia, antes de
 * se saber o resultado.
 *
 * Toda a gente dá palpites sobre futebol e ninguém os conta. É isto que
 * separa esta casa de um site de prognósticos: o que aqui se diz fica
 * escrito com o preço a que foi dito, e daqui a um mês sabe-se se valeu
 * alguma coisa — incluindo se não valeu.
 *
 * Guarda-se o primeiro veredicto e mais nenhum. A tabela não tem sequer
 * política de UPDATE: um palpite que se corrige depois do jogo não é um
 * palpite, é uma recordação.
 */

export interface VerdictRow {
  fixture_id: number;
  mercado: string;
  league: string | null;
  kickoff: string | null;
  call: string;
  fair_pct: number | null;
  price: number | null;
  edge_pp: number | null;
  because: string | null;
  decided_at: string;
  landed?: boolean | null;
}

/**
 * Sem Supabase configurado não se guarda nada — e não se rebenta.
 *
 * O veredicto continua a aparecer no ecrã: ele vale por si, e o registo
 * é para depois. Deixar a página em branco porque não há onde escrever
 * seria trocar o principal pelo acessório.
 */
function client() {
  return supabase;
}

export async function keepVerdict(
  fixtureId: number,
  league: string,
  kickoff: string | null,
  market: string,
  verdict: Verdict,
): Promise<void> {
  // Sem preço não há nada que se possa conferir depois: a decisão
  // dependeria de um número que não existia na altura.
  if (verdict.price === null) return;

  // ignoreDuplicates: o primeiro fica. Se alguém abrir o mesmo jogo
  // amanhã, com outro preço, isso não pode reescrever o que dissemos
  // hoje.
  const db = client();
  if (!db) return;

  await db.from("verdict_record").upsert(
    {
      fixture_id: fixtureId,
      mercado: market,
      league,
      kickoff,
      call: verdict.call,
      fair_pct: verdict.fairPct,
      price: verdict.price,
      edge_pp: verdict.edgePp,
      because: verdict.because,
    },
    { onConflict: "fixture_id,mercado", ignoreDuplicates: true },
  );
}

export interface VerdictTally {
  /** Quantos já foram conferidos. */
  settled: number;
  /** Destes, quantos entraram. */
  landed: number;
  winPct: number | null;
  /**
   * O que teria dado seguir os "vale a pena", a uma unidade por aposta
   * e ao preço registado. É o número que interessa — acertar muito a
   * preços maus não é ganhar.
   */
  unitsProfit: number | null;
  roi: number | null;
}

export function tallyVerdicts(rows: VerdictRow[], call: string): VerdictTally {
  const mine = rows.filter(
    (row) => row.call === call && typeof row.landed === "boolean",
  );

  const landed = mine.filter((row) => row.landed).length;
  const staked = mine.length;
  const profit = mine.reduce(
    (total, row) =>
      total + (row.landed ? (row.price ?? 1) - 1 : -1),
    0,
  );

  return {
    settled: staked,
    landed,
    winPct: staked ? Number(((landed / staked) * 100).toFixed(1)) : null,
    unitsProfit: staked ? Number(profit.toFixed(2)) : null,
    roi: staked ? Number(((profit / staked) * 100).toFixed(1)) : null,
  };
}

export async function fetchScoredVerdicts(): Promise<VerdictRow[]> {
  const db = client();
  if (!db) return [];

  const { data, error } = await db
    .from("verdict_scored")
    .select("*")
    .order("kickoff", { ascending: false })
    .limit(500);

  if (error) return [];
  return (data ?? []) as VerdictRow[];
}
