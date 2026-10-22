/**
 * Quem está de fora, dito em português e em poucas palavras.
 *
 * A fonte responde em inglês e em linguagem de ficha clínica — "injured",
 * "Cruciate Ligament Injury", "coach_decision". Quem está a decidir uma
 * aposta ao domingo de manhã não quer ler uma ficha clínica: quer saber
 * quem falta, se é certo, e até quando.
 *
 * O que não se souber traduzir passa como veio. Inventar uma tradução é
 * pior do que mostrar o original — o original pelo menos é verdade.
 */

export interface Absence {
  name: string;
  status: string;
  reason?: string;
  back?: string;
  /**
   * Que posição faz falta.
   *
   * É o mais perto que chegamos de dizer se o ausente conta: faltar o
   * guarda-redes não é faltar um extremo. Se era titular, não sabemos —
   * isso precisava de minutos jogados, e nenhuma fonte nossa os dá.
   */
  position?: string;
}

const STATUS: Record<string, string> = {
  injured: "lesionado",
  doubtful: "em dúvida",
  suspended: "suspenso",
  out: "fora",
  questionable: "em dúvida",
};

/** As queixas que esta fonte repete. O resto passa como veio. */
const REASON: Record<string, string> = {
  "knee injury": "joelho",
  "ankle injury": "tornozelo",
  "hamstring injury": "isquiotibiais",
  "muscle injury": "lesão muscular",
  "cruciate ligament injury": "ligamento cruzado",
  "meniscus injury": "menisco",
  "thigh injury": "coxa",
  "calf injury": "gémeo",
  "groin injury": "virilha",
  "back injury": "costas",
  "shoulder injury": "ombro",
  "foot injury": "pé",
  "hip injury": "anca",
  "head injury": "cabeça",
  "knock injury": "pancada",
  "broken jaw": "maxilar partido",
  "physical discomfort": "desconforto físico",
  illness: "doença",
  coach_decision: "decisão do treinador",
  suspension: "castigo",
};

export function statusLabel(status: string): string {
  return STATUS[status.trim().toLowerCase()] ?? status.trim();
}

export function reasonLabel(reason: string): string {
  const key = reason.trim().toLowerCase();
  if (!key) return "";
  return REASON[key] ?? reason.trim();
}

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/**
 * Quando se espera que volte, se é que isso ainda quer dizer alguma coisa.
 *
 * Uma data já passada não se mostra: ou ele já voltou e a ficha está
 * velha, ou ninguém sabe. Nos dois casos, dizer "volta a 20 out" num dia
 * 24 só confunde.
 */
export function backLabel(back: string, now = new Date()): string {
  const when = new Date(`${back}T12:00:00Z`);
  if (Number.isNaN(when.getTime())) return "";
  if (when.getTime() < now.getTime()) return "";
  return `volta a ${when.getUTCDate()} ${MESES[when.getUTCMonth()]}`;
}

/** As três coisas que se sabem de um ausente, sem repetir nenhuma. */
export function describeAbsence(player: Absence, now?: Date): string[] {
  const parts = [
    statusLabel(player.status),
    reasonLabel(player.reason ?? ""),
    backLabel(player.back ?? "", now),
  ].filter(Boolean);

  // "lesionado · lesão muscular" diz duas vezes a mesma coisa.
  return parts.filter((part, index) => parts.indexOf(part) === index);
}

/**
 * Os certos primeiro, depois as dúvidas, e dentro de cada um por nome.
 *
 * Quem falta de certeza muda o jogo; quem é dúvida talvez nem entre na
 * conta. Misturados, a lista obriga a ler tudo para saber qual é qual.
 */
export function sortAbsences(players: Absence[]): Absence[] {
  const weight = (player: Absence) =>
    statusLabel(player.status) === "em dúvida" ? 1 : 0;

  return [...players].sort(
    (a, b) => weight(a) - weight(b) || a.name.localeCompare(b.name, "pt"),
  );
}
