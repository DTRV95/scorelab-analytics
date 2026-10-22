import { recordVerdict } from "@/lib/matchValue";
import { measuredPct, minimumOdd } from "@/lib/shortlist";
import type { AccuracyMarket } from "@/lib/modelAccuracy";

/**
 * O que se sabe e o que não se sabe sobre um jogo, dito por inteiro.
 *
 * A página do jogo dá um número e as contas por trás dele. O que nunca diz
 * é o que ficou de fora: ninguém olha para "72%" e se lembra de perguntar
 * se o avançado está lesionado. E a resposta honesta, hoje, é que não
 * fazemos ideia — o modelo lê golos e calendário, mais nada.
 *
 * Por isso os buracos aparecem com o mesmo peso visual que o resto. Uma
 * linha cinzenta não é uma falha do ecrã, é a informação mais útil que lá
 * está: diz-te quanto é que aquele número merece.
 *
 * Teve aqui linhas para lesões, árbitro e tempo, enquanto houve esperança
 * de uma fonte que as desse. Não há: o plano gratuito da que prometia
 * pára em 2024, e a outra não tem futebol em condições. Saíram, porque
 * uma linha a dizer "sem fonte ligada" para sempre é ruído, não aviso.
 */

/** A forma por trás da previsão, no que este resumo precisa dela. */
export interface DossierForm {
  jogos_casa: number;
  jogos_fora: number;
  jogos_casa_rec: number;
  jogos_fora_rec: number;
  league_averages?: { sample_matches: number } | null;
}

export interface DossierLine {
  key: string;
  label: string;
  /** O que sabemos. Null é um buraco — e um buraco conta tanto como o resto. */
  value: string | null;
  /** Porque não sabemos. Só nas que faltam. */
  missing?: string;
  /**
   * Se este buraco muda resultados.
   *
   * Faltar o árbitro é chato; faltar quem joga é outra coisa. Só os pesados
   * entram na frase final e na advogada do diabo, senão a conta de "o que
   * falta" enche-se de pormenores e deixa de avisar de nada.
   */
  heavy?: boolean;
  /**
   * O nome curto, para quando entra numa frase.
   *
   * "Lesões e castigos" e "notícias da semana" enfiados numa enumeração
   * davam "lesões e castigos e notícias da semana", que se lê como três
   * coisas e tropeça no primeiro "e".
   */
  short?: string;
}

export interface Dossier {
  lines: DossierLine[];
  known: number;
  total: number;
  /** Os buracos que mudam resultados, pelo nome, para se escrever a frase. */
  heavyMissing: string[];
}

export interface DossierInput {
  amostraLabel: string;
  amostraPct: number;
  form: DossierForm | null;
  /** O mercado que o quadro põe à frente neste jogo, se houver. */
  headline: { market: string; pct: number } | null;
  /** Como esse mercado nos tem corrido, quando já há registo dele. */
  record: AccuracyMarket | null;
  /** Quantas odds é que já foram escritas nesta página. */
  oddsTyped: number;
  /**
   * O que as casas estão a pagar neste jogo, quando se sabe.
   *
   * `implied` já vem sem a margem da casa, calculada no servidor: uma
   * odd de 2,00 não é 50%, e comparar a nossa probabilidade com a leitura
   * bruta era dar-nos razão de graça.
   */
  market?: {
    odds: Record<string, number>;
    implied: Record<string, number>;
    /**
     * As duas fontes listam este jogo com as equipas ao contrário.
     *
     * Não dá objecção nenhuma, de propósito. Medido em três jogos
     * reais, dispara em dois — e não sei qual das fontes está errada
     * sobre quem recebe. Um aviso grave que aparece em dois terços dos
     * jogos, apoiado num campo em que não confio, ensina a ignorar os
     * avisos todos. Fica guardado até haver com que o julgar.
     */
    homeAwayDisagrees?: boolean;
  } | null;
  /** Os nomes das duas equipas, que são as chaves do que vem a seguir. */
  teams?: { home: string; away: string };
  /**
   * Quem falta, por equipa.
   *
   * Null é "ninguém olhou"; um objecto com listas vazias é "estão todos
   * bons". São respostas diferentes e o ecrã mostra-as diferentes.
   */
  absences?: Record<string, { name: string; status: string }[]> | null;
  /** Os títulos da semana sobre cada equipa, como saíram dos jornais. */
  news?: Record<string, { title: string }[]> | null;
}

/** Quantas pessoas faltam às duas equipas, ao todo. */
export function absenceCount(
  absences: DossierInput["absences"],
): number | null {
  if (!absences) return null;
  return Object.values(absences).reduce((total, list) => total + list.length, 0);
}

function newsCount(news: DossierInput["news"]): number {
  if (!news) return 0;
  return Object.values(news).reduce((total, list) => total + list.length, 0);
}

const plural = (n: number, um: string, muitos: string) =>
  `${n} ${n === 1 ? um : muitos}`;

/** Um número como se escreve cá, com vírgula. */
const num = (value: number, casas = 1) =>
  value.toFixed(casas).replace(".", ",");

export function buildDossier(input: DossierInput): Dossier {
  const { form } = input;
  const recentes = form ? form.jogos_casa_rec + form.jogos_fora_rec : 0;
  const liga = form?.league_averages?.sample_matches ?? 0;
  const registo = recordVerdict(input.record) !== "unknown" ? input.record : null;

  const lines: DossierLine[] = [
    {
      key: "historico",
      label: "Histórico da época",
      value: `${input.amostraLabel} · ${input.amostraPct.toFixed(
        0,
      )}% do necessário`,
    },
    {
      key: "forma",
      label: "Forma recente",
      value: recentes > 0 ? `${plural(recentes, "jogo lido", "jogos lidos")}` : null,
      missing: "a época ainda não tem jogos que cheguem",
    },
    {
      key: "casaFora",
      label: "Casa e fora em separado",
      value:
        form && form.jogos_casa > 0 && form.jogos_fora > 0
          ? `${form.jogos_casa} em casa, ${form.jogos_fora} fora`
          : null,
      missing: "uma das equipas ainda não tem os dois lados",
    },
    {
      key: "liga",
      label: "Média da competição",
      value: liga > 0 ? `${plural(liga, "jogo", "jogos")} da liga` : null,
      missing: "sem média da competição para comparar",
    },
    {
      key: "registo",
      label: "O nosso registo neste mercado",
      value: registo
        ? `${plural(registo.samples, "jogo conferido", "jogos conferidos")}`
        : null,
      missing: "ainda não o conferimos vezes que cheguem",
    },
    {
      key: "mercado",
      label: "Preço do mercado",
      value: input.market
        ? `${plural(
            Object.keys(input.market.odds).length,
            "mercado lido",
            "mercados lidos",
          )}`
        : null,
      missing: "não encontrámos este jogo nas casas",
      heavy: true,
      short: "o que as casas estão a pagar",
    },
    {
      key: "baixas",
      label: "Quem está de fora",
      value: (() => {
        const total = absenceCount(input.absences);
        if (total === null) return null;
        return total === 0
          ? "ninguém, pelo que se sabe"
          : plural(total, "jogador de fora", "jogadores de fora");
      })(),
      missing: "não encontrámos este jogo na fonte de baixas",
      heavy: true,
      short: "quem está de fora",
    },
    {
      key: "noticias",
      label: "Notícias da semana",
      value: newsCount(input.news)
        ? plural(newsCount(input.news), "notícia", "notícias")
        : null,
      missing: "nada nos jornais sobre estas equipas",
    },
    {
      key: "preco",
      label: "A tua odd",
      value:
        input.oddsTyped > 0
          ? `${plural(input.oddsTyped, "odd escrita", "odds escritas")}`
          : null,
      missing: "escreve a odd lá em baixo e eu comparo",
    },
  ];

  return {
    lines,
    known: lines.filter((line) => line.value !== null).length,
    total: lines.length,
    heavyMissing: lines
      .filter((line) => line.value === null && line.heavy)
      .map((line) => line.short ?? line.label.toLowerCase()),
  };
}

/** Uma lista escrita como se fala: "a, b e c". */
export function enumerate(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

export interface Objection {
  key: string;
  text: string;
  /** As que travam a aposta, não as que só a temperam. */
  grave: boolean;
}

/**
 * O que joga contra — a única voz desta casa que não quer que tu apostes.
 *
 * Nada disto é opinião: cada linha sai de uma medição nossa. O exagero no
 * topo é o que o registo mostrou, a odd mínima é aritmética, o histórico
 * curto é a contagem. Uma objecção inventada seria pior do que nenhuma,
 * porque esta é a secção em que se acredita.
 */
export function objections(input: DossierInput, dossier: Dossier): Objection[] {
  const found: Objection[] = [];
  const { headline } = input;

  if (headline) {
    const medido = measuredPct(headline.pct);
    const desconto = headline.pct - medido;
    if (desconto >= 1) {
      found.push({
        key: "topo",
        text: `O modelo diz ${num(
          headline.pct,
        )}%, mas acima dos 55% tem prometido a mais do que entrega. Medido pelo nosso registo, isto vale ${num(
          medido,
        )}%.`,
        grave: desconto >= 8,
      });
    }

    const minima = minimumOdd(headline.pct);
    const price = input.market?.odds[headline.market];
    const mercado = input.market?.implied[headline.market];

    if (typeof price === "number") {
      // A objecção mais útil que esta casa sabe dar: o preço que está
      // mesmo na mesa contra o preço de que precisarias.
      found.push({
        key: "minima",
        text:
          price < minima
            ? `O mercado está a pagar ${num(price, 2)} e tu precisavas de pelo menos ${num(
                minima,
                2,
              )}. A esta odd não há aposta — mesmo acertando a maioria das vezes, perdes.`
            : `O mercado está a pagar ${num(price, 2)} e a tua conta fecha a partir de ${num(
                minima,
                2,
              )}.`,
        grave: price < minima,
      });
    } else {
      found.push({
        key: "minima",
        text: `A esta probabilidade, abaixo de ${num(
          minima,
          2,
        )} perdes dinheiro mesmo acertando a maioria das vezes.`,
        grave: false,
      });
    }

    if (typeof mercado === "number") {
      const nosso = measuredPct(headline.pct);
      const gap = nosso - mercado;
      if (Math.abs(gap) >= 5) {
        found.push({
          key: "mercado",
          text:
            gap > 0
              ? `Nós damos ${num(nosso)}% a isto e o mercado dá ${num(
                  mercado,
                )}%. Quando discordamos tanto de milhares de pessoas com dinheiro em cima, quem costuma estar errado somos nós.`
              : `O mercado dá ${num(mercado)}% a isto e nós só ${num(
                  nosso,
                )}%. Eles sabem alguma coisa que o nosso modelo não lê — lesões, equipa, notícias.`,
          grave: Math.abs(gap) >= 12,
        });
      }
    }
  }

  if (input.amostraPct < 60) {
    found.push({
      key: "amostra",
      text: `Pouco histórico sustenta este número: ${num(
        input.amostraPct,
        0,
      )}% do que seria preciso.`,
      grave: true,
    });
  }

  if (recordVerdict(input.record) === "over" && input.record) {
    found.push({
      key: "registo",
      text: `Neste mercado já prometemos ${num(
        Math.abs(input.record.gap_pp),
      )} pontos a mais do que entregámos, em ${
        input.record.samples
      } jogos conferidos.`,
      grave: true,
    });
  }

  // Quem falta, dito pelos nomes. Não se pesa a importância de cada um —
  // não temos minutos nem golos por jogador, e inventar um peso era
  // exactamente o erro que esta secção existe para evitar. Contam-se e
  // dizem-se; quem conhece as equipas és tu.
  const baixas = input.absences;
  if (baixas && input.teams) {
    for (const side of [input.teams.home, input.teams.away]) {
      const lista = baixas[side] ?? [];
      if (lista.length === 0) continue;
      const nomes = enumerate(lista.slice(0, 4).map((p) => p.name));
      const resto = lista.length > 4 ? ` e mais ${lista.length - 4}` : "";
      found.push({
        key: `baixas-${side}`,
        text: `Fora no ${side}: ${nomes}${resto}. O número acima não sabe disto — o modelo lê golos e calendário.`,
        grave: lista.length >= 3,
      });
    }
  }

  if (dossier.heavyMissing.length > 0) {
    found.push({
      key: "buracos",
      text: `Não sabemos ${enumerate(
        dossier.heavyMissing,
      )}. Se faltar um titular a uma das equipas, o número acima não dá por isso.`,
      grave: dossier.heavyMissing.length > 1,
    });
  }

  // As que travam primeiro. Dentro de cada grupo fica a ordem por que
  // foram escritas, que vai do número para o que falta à volta dele.
  return [...found].sort((a, b) => Number(b.grave) - Number(a.grave));
}
