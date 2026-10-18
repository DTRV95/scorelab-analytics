import { supabase } from "@/lib/supabaseClient";

/**
 * Os jogos que alguém marcou para seguir.
 *
 * Vivem na gaveta que já existe para estado por conta — `user_entity_state`,
 * com RLS a deixar cada um ver e escrever só as suas linhas — e não numa
 * tabela nova: é uma lista de números por pessoa, e uma tabela para isso era
 * uma migração e uma política para guardar o que cabe num campo.
 *
 * Ficam na conta e não no telefone de propósito. Marcar um jogo no telemóvel
 * de manhã e abrir o computador à tarde sem ele lá seria o mesmo que não ter
 * marcado nada. O telemóvel guarda uma cópia, mas só para a estrela já estar
 * acesa no primeiro instante, antes de a rede responder.
 */
const ENTITY_KEY = "favourite_matches";
const LOCAL_KEY = "scorelab_favourite_matches";

/** Só números inteiros, sem repetidos e por ordem: um conjunto, escrito. */
function clean(ids: unknown): number[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<number>();
  ids.forEach((id) => {
    const n = Number(id);
    if (Number.isInteger(n) && n > 0) seen.add(n);
  });
  return [...seen].sort((a, b) => a - b);
}

export function readLocalFavourites(): number[] {
  try {
    return clean(JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function writeLocalFavourites(ids: number[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(clean(ids)));
  } catch {
    // Uma janela privada, ou o disco cheio. A conta continua a saber.
  }
}

/** O que a conta tem guardado. `null` quando não houve resposta. */
export async function fetchFavourites(): Promise<number[] | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("user_entity_state")
    .select("payload")
    .eq("entity_key", ENTITY_KEY)
    .maybeSingle();

  if (error) return null;
  if (!data) return [];

  const payload = data.payload as { fixtureIds?: unknown } | null;
  return clean(payload?.fixtureIds);
}

/**
 * Guarda a lista inteira, não a diferença.
 *
 * Duas marcações ao mesmo tempo em dois aparelhos deixam a última a mandar.
 * Para uma lista que uma pessoa mexe com o dedo, de vez em quando, isso é
 * bastante — e é muito menos código do que reconciliar duas listas.
 */
export async function saveFavourites(
  userId: string,
  ids: number[],
): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase.from("user_entity_state").upsert(
    {
      user_id: userId,
      entity_key: ENTITY_KEY,
      payload: { fixtureIds: clean(ids) },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,entity_key" },
  );

  return !error;
}

/** A lista com o jogo dentro, ou sem ele. */
export function toggled(ids: number[], fixtureId: number): number[] {
  return ids.includes(fixtureId)
    ? ids.filter((id) => id !== fixtureId)
    : clean([...ids, fixtureId]);
}
