import { statusLabel } from "@/lib/absences";
import type { Absence } from "@/lib/marketPrice";

/**
 * O que há de próprio neste jogo, numa frase.
 *
 * A sugestão estava a sair toda igual. Não por engano no cálculo — os
 * números mudavam de jogo para jogo — mas porque a frase era sempre o
 * mesmo molde: damos tanto, as casas dão tanto, o preço compensa ou
 * não. Oito cartões assim leem-se como uma carta-tipo, e quem os lê
 * deixa de os ler ao terceiro.
 *
 * Falta-lhes o jogo. O Alavés marcar 1,67 em casa, o Chelsea ter oito
 * jogadores de fora, ninguém ser favorito, o quadro liderar com um
 * mercado e o preço estar noutro — tudo isto já está na página,
 * espalhado por caixas, e nada disto entrava na frase que decide.
 *
 * Sai uma observação por jogo, a mais notável. Duas davam um parágrafo
 * onde era precisa uma linha, e a segunda mais notável é quase sempre
 * a que se podia dispensar.
 */

export interface MatchNote {
  /** As equipas, que a frase nomeia. Sem elas é um jogo qualquer. */
  teams?: { home: string; away: string } | null;
  /** Os golos que o modelo espera de cada lado. */
  goals?: { home: number; away: number; total: number } | null;
  /** As probabilidades em bruto, para se saber a forma do jogo. */
  chances?: { home: number; away: number } | null;
  /** O mercado que o quadro pôs à frente. */
  headline?: string | null;
  absences?: Record<string, Absence[]> | null;
  /** O mercado escolhido, e quanto discordamos das casas nele. */
  pick?: { market: string; gap: number | null } | null;
  /** Como se escreve o nome de um mercado para quem lê. */
  label?: (market: string) => string;
}

const num = (value: number) => value.toFixed(2).replace(".", ",");

/** Golos a mais e a menos, medidos contra o que é um jogo normal. */
const MUITOS_GOLOS = 3.1;
const POUCOS_GOLOS = 2.3;
/** A partir daqui alguém é favorito a sério. */
const FAVORITO = 58;
/** E abaixo disto, de diferença, não é favorito nenhum. */
const EQUILIBRIO = 6;
/** Faltas que chegam para a equipa deixar de ser a que foi medida. */
const BURACO = 3;

function certas(
  absences: Record<string, Absence[]> | null | undefined,
  side: string | null | undefined,
): Absence[] {
  if (!absences || !side) return [];
  return (absences[side] ?? []).filter(
    (player) => statusLabel(player.status) !== "em dúvida",
  );
}

/** Onde é que o buraco está, quando se sabe. */
function onde(players: Absence[]): string {
  const linhas: Record<string, string> = {
    g: "na baliza",
    d: "na defesa",
    m: "no meio",
    f: "no ataque",
  };

  const contagem = new Map<string, number>();
  for (const player of players) {
    const linha = linhas[(player.position ?? "").trim().toLowerCase()];
    if (linha) contagem.set(linha, (contagem.get(linha) ?? 0) + 1);
  }

  const maior = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0];
  return maior && maior[1] >= 2 ? `, ${maior[1]} deles ${maior[0]}` : "";
}

/**
 * A frase que distingue este jogo dos outros sete do sábado.
 *
 * Por ordem do que pesa mais. As baixas primeiro, que são a única
 * coisa aqui capaz de mudar o jogo depois de a conta estar feita; a
 * seguir a forma do jogo, que é o que o modelo viu; e por fim o
 * desencontro entre o que o quadro lidera e o que o preço escolheu,
 * que explica a pergunta que o cartão levanta sozinho — porquê este
 * mercado e não o que está em cima.
 */
export type NoteKind =
  | "baixas"
  | "golos"
  | "favorito"
  | "mercado"
  | "acordo"
  | "nada";

export interface Note {
  /**
   * De que é que esta frase fala.
   *
   * Serve para o cartão não dizer a mesma coisa duas vezes: quando a
   * observação já abriu com as baixas, a linha da exigência cala-as.
   * Compará-las por texto era frágil — "8 fora no Chelsea" e "o
   * Chelsea leva 8 jogadores de fora" são a mesma coisa escrita de
   * duas maneiras, e nenhuma contém a outra.
   */
  kind: NoteKind;
  text: string;
}

export function noteOf(note: MatchNote): Note {
  const { teams, goals, chances, absences, pick, headline } = note;
  const name = note.label ?? ((market: string) => market);

  if (teams) {
    const faltas = [
      { nome: teams.home, lista: certas(absences, teams.home) },
      { nome: teams.away, lista: certas(absences, teams.away) },
    ]
      .filter((team) => team.lista.length >= BURACO)
      .sort((a, b) => b.lista.length - a.lista.length);

    if (faltas.length === 2) {
      return { kind: "baixas", text: `Os dois chegam desfalcados: ${faltas[0].lista.length} fora no ${faltas[0].nome} e ${faltas[1].lista.length} no ${faltas[1].nome}.` };
    }
    if (faltas.length === 1) {
      const team = faltas[0];
      return { kind: "baixas", text: `O ${team.nome} leva ${team.lista.length} jogadores de fora${onde(
        team.lista,
      )}, e não é a equipa que o modelo mediu.` };
    }
  }

  if (goals && teams) {
    if (goals.total >= MUITOS_GOLOS) {
      return { kind: "golos", text: `Esperam-se ${num(goals.total)} golos: ${num(
        goals.home,
      )} do ${teams.home} e ${num(goals.away)} do ${teams.away}.` };
    }
    if (goals.total <= POUCOS_GOLOS) {
      return { kind: "golos", text: `Jogo fechado à partida — ${num(
        goals.total,
      )} golos esperados ao todo.` };
    }
  }

  if (chances && teams) {
    if (chances.home >= FAVORITO) {
      return { kind: "favorito", text: `O ${teams.home} é claro favorito em casa.` };
    }
    if (chances.away >= FAVORITO) {
      return { kind: "favorito", text: `O ${teams.away} é favorito mesmo jogando fora.` };
    }
    if (Math.abs(chances.home - chances.away) <= EQUILIBRIO) {
      return { kind: "favorito", text: `Jogo sem favorito: damos quase as mesmas hipóteses aos dois.` };
    }
  }

  // Porquê este mercado e não o que está lá em cima em letras grandes.
  // É a pergunta que o cartão levanta sozinho sempre que os dois não
  // coincidem, e que ficava por responder.
  if (headline && pick && pick.market !== headline) {
    return { kind: "mercado", text: `O quadro lidera com ${name(
      headline,
    )}, mas o preço que compensa está noutro sítio.` };
  }

  // Concordarmos com as casas é uma informação, e das boas: é quando o
  // número não está a depender só de nós.
  if (pick && pick.gap !== null && Math.abs(pick.gap) <= 2) {
    return { kind: "acordo", text: `Nós e as casas vemos este jogo da mesma maneira, que é o melhor sinal que há.` };
  }

  return { kind: "nada", text: "" };
}
