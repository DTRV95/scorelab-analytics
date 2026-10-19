/**
 * O boletim em construção, que anda com a pessoa de página em página.
 *
 * Juntar um jogo do quadro ao desafio levava para a página do desafio. Isso
 * resolve um jogo e estraga dois: para pôr o segundo era preciso voltar
 * atrás, encontrar outra vez onde se estava na lista, e a escolha que já
 * tinha sido feita ficava num ecrã que já não se via. Um boletim é de vários
 * jogos por natureza — a odd combinada é a razão de ele existir — por isso
 * tem de sobreviver à navegação.
 *
 * Vive no telemóvel e não na conta. É uma coisa de minutos, de um
 * aparelho só, que deixa de existir mal se registe: guardá-la na conta seria
 * sincronizar um rascunho entre dispositivos onde ninguém o vai procurar.
 * O que tem de sobreviver a tudo é a aposta registada, e essa já vai para lá.
 */

const KEY = "scorelab_draft_slip";

export interface SlipLeg {
  /** Uma perna por jogo: a chave é o jogo. */
  key: string;
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  market: string;
  modelProb: number;
  kickoff: string | null;
  /** Como foi escrito, para "1," a caminho de "1,85" não ser comido. */
  odds: string;
}

export interface DraftSlip {
  /** O desafio onde isto vai ser registado. Null com o boletim vazio. */
  planId: string | null;
  legs: SlipLeg[];
  /** Como foi escrito. Null quer dizer "o que o nível pede". */
  stake: string | null;
}

export const EMPTY_SLIP: DraftSlip = { planId: null, legs: [], stake: null };

export function legKey(fixtureId: number): string {
  return `f${fixtureId}`;
}

/**
 * O jogo entra, ou não entra por já lá estar.
 *
 * Duas pernas do mesmo jogo no mesmo boletim não é uma aposta que exista —
 * é a mesma regra que a lista de inserir jogos já aplica, e aqui tem de ser
 * aplicada outra vez porque o jogo pode chegar de outro sítio.
 */
export function withLeg(
  slip: DraftSlip,
  planId: string,
  leg: Omit<SlipLeg, "key">,
): DraftSlip {
  const key = legKey(leg.fixtureId);
  if (slip.legs.some((entry) => entry.key === key)) return slip;

  return {
    // O primeiro jogo é quem decide de quem é o boletim. Depois disso o
    // desafio só muda por quem o mandar mudar.
    planId: slip.planId ?? planId,
    legs: [...slip.legs, { ...leg, key }],
    stake: slip.stake,
  };
}

export function withoutLeg(slip: DraftSlip, key: string): DraftSlip {
  const legs = slip.legs.filter((entry) => entry.key !== key);
  // Sem jogos não há boletim: tirar o último apaga também o desafio e o
  // valor escrito, para o seguinte não começar com as sobras deste.
  return legs.length === 0 ? EMPTY_SLIP : { ...slip, legs };
}

export function withOdds(
  slip: DraftSlip,
  key: string,
  odds: string,
): DraftSlip {
  return {
    ...slip,
    legs: slip.legs.map((entry) =>
      entry.key === key ? { ...entry, odds } : entry,
    ),
  };
}

/**
 * Mudar de desafio não desfaz o boletim.
 *
 * Os jogos são os jogos; de quem é a aposta é outra decisão, e mudá-la não
 * tem nada que apagar o trabalho de os escolher. O valor é que volta ao que
 * o nível pede, porque esse é do nível e o nível mudou.
 */
export function withPlan(slip: DraftSlip, planId: string): DraftSlip {
  if (slip.planId === planId) return slip;
  return { ...slip, planId, stake: null };
}

export function withStake(slip: DraftSlip, stake: string | null): DraftSlip {
  return { ...slip, stake };
}

/** O preço convertido, ou 0 quando ainda não é um preço. */
export function toOdds(raw: string): number {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 1 ? value : 0;
}

export function isPriced(slip: DraftSlip): boolean {
  return slip.legs.length > 0 && slip.legs.every((leg) => toOdds(leg.odds) > 0);
}

/**
 * As pernas multiplicadas, ou 0 enquanto faltar um preço.
 *
 * Mostrar uma odd combinada a meio de ser escrita é pior do que não mostrar
 * nenhuma: parece um número e é metade de um.
 */
export function slipOdds(slip: DraftSlip): number {
  if (!isPriced(slip)) return 0;
  return Number(
    slip.legs
      .reduce((product, leg) => product * toOdds(leg.odds), 1)
      .toFixed(2),
  );
}

function clean(value: unknown): DraftSlip {
  if (!value || typeof value !== "object") return EMPTY_SLIP;
  const source = value as Partial<DraftSlip>;
  if (!Array.isArray(source.legs)) return EMPTY_SLIP;

  const legs: SlipLeg[] = [];
  for (const raw of source.legs) {
    const leg = raw as Partial<SlipLeg>;
    if (!Number.isInteger(leg.fixtureId) || !leg.market) continue;
    const fixtureId = leg.fixtureId as number;
    legs.push({
      key: legKey(fixtureId),
      fixtureId,
      homeTeam: String(leg.homeTeam ?? ""),
      awayTeam: String(leg.awayTeam ?? ""),
      league: String(leg.league ?? ""),
      market: String(leg.market),
      modelProb: Number(leg.modelProb) || 0,
      kickoff: typeof leg.kickoff === "string" ? leg.kickoff : null,
      odds: typeof leg.odds === "string" ? leg.odds : "",
    });
  }

  if (legs.length === 0) return EMPTY_SLIP;

  return {
    planId: typeof source.planId === "string" ? source.planId : null,
    legs,
    stake: typeof source.stake === "string" ? source.stake : null,
  };
}

export function readSlip(): DraftSlip {
  try {
    return clean(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    // Janela privada, armazenamento bloqueado, ou um boletim escrito por uma
    // versão que já não existe. Começa-se vazio, que é sempre válido.
    return EMPTY_SLIP;
  }
}

export function writeSlip(slip: DraftSlip): void {
  try {
    if (slip.legs.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(slip));
  } catch {
    // O boletim continua a funcionar nesta página; só não sobrevive a um
    // recarregamento. Perder isso em silêncio é melhor do que rebentar.
  }
}
