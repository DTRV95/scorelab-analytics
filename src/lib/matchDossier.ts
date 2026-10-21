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
 * linha cinzenta a dizer "lesões: sem fonte ligada" não é uma falha do
 * ecrã, é a informação mais útil que lá está: diz-te quanto é que aquele
 * número merece.
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
      key: "preco",
      label: "Preço da casa de apostas",
      value:
        input.oddsTyped > 0
          ? `${plural(input.oddsTyped, "odd escrita", "odds escritas")}`
          : null,
      missing: "escreve a odd lá em baixo e eu comparo",
    },
    {
      key: "lesoes",
      label: "Lesões e castigos",
      value: null,
      missing: "sem fonte ligada",
      heavy: true,
      short: "quem está de fora",
    },
    {
      key: "noticias",
      label: "Notícias da semana",
      value: null,
      missing: "sem fonte ligada",
      heavy: true,
      short: "as notícias da semana",
    },
    {
      key: "arbitro",
      label: "Árbitro",
      value: null,
      missing: "sem fonte ligada",
    },
    {
      key: "tempo",
      label: "Tempo e relvado",
      value: null,
      missing: "sem fonte ligada",
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

    found.push({
      key: "minima",
      text: `A esta probabilidade, abaixo de ${num(
        minimumOdd(headline.pct),
        2,
      )} perdes dinheiro mesmo acertando a maioria das vezes.`,
      grave: false,
    });
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
