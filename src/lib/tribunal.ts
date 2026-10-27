import { recordVerdict } from "@/lib/matchValue";
import { losing, patternFor, type Patterns } from "@/lib/betPatterns";
import { statusLabel } from "@/lib/absences";
import type { Absence } from "@/lib/marketPrice";
import type { AccuracyMarket } from "@/lib/modelAccuracy";
import type { MarketQuote } from "@/lib/suggestion";

/**
 * As cinco testemunhas, a votar à vista.
 *
 * Isto não decide nada — quem decide é `suggest`, e dois juízos sobre o
 * mesmo jogo no mesmo ecrã não são o dobro da ajuda, são metade da
 * confiança. O que isto faz é mostrar a decisão por dentro: as mesmas
 * cinco provas que entram na conta, cada uma com o seu voto e a sua
 * razão, em vez de saírem já somadas numa frase.
 *
 * São cinco porque são cinco as coisas que sabemos de um jogo e que não
 * dependem umas das outras:
 *
 *   o modelo      — a nossa probabilidade contra o preço;
 *   o mercado     — milhares de pessoas com dinheiro em cima;
 *   o registo     — o que o modelo já fez neste mercado;
 *   o dinheiro    — o que as nossas apostas já fizeram em mercados assim;
 *   o plantel     — quem falta, que o modelo não vê.
 *
 * Quem não tem nada a dizer cala-se, e calar-se conta como calar-se: um
 * tribunal onde a ausência de prova vota a favor é um tribunal que
 * absolve sempre.
 */

export type Vote = "bate" | "falha" | "cala-se";

export interface Judge {
  who: string;
  vote: Vote;
  because: string;
}

export interface Trial {
  judges: Judge[];
  /** Quantos votaram a favor e quantos contra. Quem se cala não conta. */
  favour: number;
  against: number;
}

/** A partir daqui discordar do mercado é sinal de que somos nós. */
const GAP_WARN = 8;
/** E até aqui é acordo, que é a prova mais forte que há. */
const GAP_OK = 3;
/** Faltas que chegam para a equipa deixar de ser a que foi medida. */
const SQUAD_HOLE = 3;

const pct = (value: number) => `${Math.round(value)}%`;

export interface TrialInput {
  record: Map<string, AccuracyMarket>;
  patterns?: Patterns | null;
  absences?: Record<string, Absence[]> | null;
  teams?: { home: string; away: string } | null;
}

function certas(
  absences: Record<string, Absence[]> | null | undefined,
  side: string | null | undefined,
): number {
  if (!absences || !side) return 0;
  return (absences[side] ?? []).filter(
    (player) => statusLabel(player.status) !== "em dúvida",
  ).length;
}

export function tribunal(input: TrialInput, pick: MarketQuote | null): Trial {
  const judges: Judge[] = [];

  // 1. O modelo, contra o preço que lhe põem à frente.
  if (!pick || pick.edge === null) {
    judges.push({
      who: "Modelo",
      vote: "cala-se",
      because: "sem preço não há nada que o modelo possa dizer",
    });
  } else if (pick.edge > 0) {
    judges.push({
      who: "Modelo",
      vote: "bate",
      because: `damos ${pct(pick.ours)} e o preço vale ${pct(100 / (pick.price as number))}`,
    });
  } else {
    judges.push({
      who: "Modelo",
      vote: "falha",
      because: `damos ${pct(pick.ours)} e o preço já pede ${pct(100 / (pick.price as number))}`,
    });
  }

  // 2. O mercado. Concordar connosco é a prova mais forte que há, e
  //    discordar muito é o aviso que o nosso registo justifica.
  const gap = pick?.gap ?? null;
  if (gap === null) {
    judges.push({
      who: "Mercado",
      vote: "cala-se",
      because: "as casas ainda não abriram este mercado",
    });
  } else if (gap >= GAP_WARN) {
    judges.push({
      who: "Mercado",
      vote: "falha",
      because: `estamos ${Math.round(gap)} pontos acima das casas`,
    });
  } else if (Math.abs(gap) <= GAP_OK) {
    judges.push({
      who: "Mercado",
      vote: "bate",
      because: "as casas vêem este jogo como nós",
    });
  } else {
    judges.push({
      who: "Mercado",
      vote: "cala-se",
      because: "nem concordam nem discordam o suficiente",
    });
  }

  // 3. O que o modelo já fez neste mercado, medido.
  const registo = pick ? (input.record.get(pick.market) ?? null) : null;
  const diz = recordVerdict(registo);
  if (!pick || diz === "unknown") {
    judges.push({
      who: "Registo",
      vote: "cala-se",
      because: "poucos jogos marcados neste mercado",
    });
  } else if (diz === "over") {
    judges.push({
      who: "Registo",
      vote: "falha",
      because: `prometeu ${pct(registo?.predicted_pct ?? 0)} e entregou ${pct(registo?.actual_pct ?? 0)}`,
    });
  } else {
    judges.push({
      who: "Registo",
      vote: "bate",
      because: `prometeu ${pct(registo?.predicted_pct ?? 0)} e entregou ${pct(registo?.actual_pct ?? 0)}`,
    });
  }

  // 4. O nosso próprio dinheiro em mercados desta família.
  const nosso = pick ? patternFor(pick.market, input.patterns ?? null) : null;
  if (!nosso) {
    judges.push({
      who: "Dinheiro",
      vote: "cala-se",
      because: "ainda não apostámos o suficiente em mercados assim",
    });
  } else {
    // Arredondado a cêntimos, um retorno pequeno dá zero — e "ganhámos
    // 0 cêntimos por euro" é dizer nada com números. Abaixo de meio
    // cêntimo diz-se o que isso é: ficou na mesma.
    const centimos = Math.round(nosso.perEuro * 100);
    judges.push({
      who: "Dinheiro",
      // Empatar não é prova a favor. Quem saiu de lá com o dinheiro
      // com que entrou não tem nada a dizer sobre o próximo, e contar
      // isso como voto favorável era encher o tribunal de maiorias
      // feitas de nada.
      vote: centimos === 0 ? "cala-se" : losing(nosso) ? "falha" : "bate",
      because:
        centimos === 0
          ? `em "${nosso.key}" ficámos na mesma, em ${nosso.n} apostas`
          : `em "${nosso.key}" ${centimos > 0 ? "ganhámos" : "perdemos"} ${Math.abs(
              centimos,
            )} cêntimos por euro`,
    });
  }

  // 5. O plantel, que é a única prova aqui capaz de mudar o jogo depois
  //    de a conta estar feita.
  const lados = input.teams
    ? [input.teams.home, input.teams.away].map((nome) => ({
        nome,
        fora: certas(input.absences, nome),
      }))
    : [];
  const desfalcados = lados.filter((lado) => lado.fora >= SQUAD_HOLE);

  if (!input.absences || lados.length === 0) {
    judges.push({
      who: "Plantel",
      vote: "cala-se",
      because: "ninguém olhou a quem falta",
    });
  } else if (desfalcados.length > 0) {
    judges.push({
      who: "Plantel",
      vote: "falha",
      because: desfalcados
        .map((lado) => `${lado.nome} com ${lado.fora} fora`)
        .join(" e "),
    });
  } else {
    judges.push({
      who: "Plantel",
      vote: "bate",
      because: "estão os dois praticamente completos",
    });
  }

  return {
    judges,
    favour: judges.filter((judge) => judge.vote === "bate").length,
    against: judges.filter((judge) => judge.vote === "falha").length,
  };
}
