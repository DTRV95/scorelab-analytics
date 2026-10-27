import { useEffect } from "react";
import { Ban, Loader2, Sparkles } from "lucide-react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { enumerate } from "@/lib/matchDossier";
import { getKellyPct } from "@/lib/calibrationEngine";
import { tribunal, type Vote } from "@/lib/tribunal";
import {
  suggest,
  type Call,
  type Suggestion,
  type SuggestionInput,
} from "@/lib/suggestion";

/**
 * A sugestão para este jogo, à cabeça.
 *
 * Tudo o que vem por baixo é material: quinze mercados, o preço de cada
 * um, o que falta saber. Isso serve para confirmar uma decisão, não para
 * a tomar — e com oito jogos num sábado de manhã ninguém faz oito
 * sínteses. Esta é a síntese, com o número que a sustenta ao lado para
 * não ter de se acreditar nela.
 *
 * Um mercado, um preço, e uma frase que acaba sempre em alguma coisa
 * para fazer: paga tanto a mais; entra com metade; não vale o preço.
 * Houve aqui uma etiqueta a dizer "aposto pouco", que é um adjectivo
 * onde devia estar uma instrução — a força da opinião lê-se na cor e no
 * fim da frase, e a frase ficou mais curta sem ela.
 *
 * E diz-se também o que evitar, que é a pergunta que ninguém faz: o
 * mercado em que mais discordamos das casas parece sempre o melhor do
 * cartaz, e é aquele onde o nosso registo mostra que nos enganamos.
 */

const label = (market: string) => MARKET_LABELS[market] ?? market;

/**
 * Duas barras, uma por cima da outra.
 *
 * O que o cartão sempre disse em palavras — "damos-lhe 54 hipóteses em
 * 100 e as casas dão 46" — visto de uma vez. Uma frase obriga a
 * comparar dois números de cabeça; duas barras já estão comparadas.
 */
function Bar({
  who,
  pct,
  tone,
}: {
  who: string;
  pct: number;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <p className="sl-meta w-[62px] flex-none text-[9.5px] uppercase tracking-[0.06em]">
        {who}
      </p>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
      <p className="font-mono-data w-[34px] flex-none text-right text-[12px] font-bold text-foreground">
        {Math.round(pct)}%
      </p>
    </div>
  );
}

/** Um número com o nome por cima e o que ele quer dizer por baixo. */
function Figure({
  label: nome,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-1 py-1.5 text-center">
      <p className="sl-meta truncate text-[9px] uppercase tracking-[0.02em]">
        {nome}
      </p>
      <p
        className={`font-mono-data mt-0.5 truncate text-[14px] font-bold ${
          tone ?? "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="sl-meta truncate text-[9px]">{note}</p>
    </div>
  );
}

const VOTO: Record<Vote, { ponto: string; texto: string }> = {
  bate: {
    ponto: "bg-[hsl(var(--sl-green))]",
    texto: "text-foreground",
  },
  falha: { ponto: "bg-destructive", texto: "text-foreground" },
  "cala-se": { ponto: "bg-muted-foreground/30", texto: "text-muted-foreground" },
};

const odd = (value: number) => value.toFixed(2).replace(".", ",");

/** Verde onde se decide, azul onde se mede, cinzento onde não se mexe. */
const TOM: Record<Call, { texto: string; fundo: string }> = {
  apostar: {
    texto: "text-[hsl(var(--sl-green))]",
    fundo: "bg-[hsl(var(--sl-green))]/[0.07]",
  },
  pequena: {
    texto: "text-[hsl(var(--sl-cool))]",
    fundo: "bg-[hsl(var(--sl-cool))]/[0.07]",
  },
  passar: { texto: "text-foreground", fundo: "bg-muted/40" },
  esperar: { texto: "text-foreground", fundo: "bg-muted/40" },
};

export function SuggestionCard({
  sample,
  onDecided,
  loading,
  ...props
}: Omit<SuggestionInput, "label"> & {
  /**
   * Ainda falta chegar alguma coisa que muda a resposta.
   *
   * O preço, o registo do modelo, o exagero por mercado e as nossas
   * pernas fechadas chegam todos depois do primeiro desenho. Sem isto,
   * o cartão decidia com o que tinha — ou seja, só com o número do
   * modelo — e dois segundos depois mudava de ideias à frente de quem
   * estava a ler. A primeira coisa que se vê tem de ser a resposta, e
   * entre uma resposta errada já e a certa daqui a um instante, é a
   * certa que vale.
   */
  loading?: boolean;
  /**
   * A decisão, assim que está tomada.
   *
   * Quem monta o cartão é que sabe de que jogo ele é, e é quem a pode
   * guardar. O cartão decide e não escreve em lado nenhum: um
   * componente que desenha e grava ao mesmo tempo grava duas vezes
   * mal alguém mude o desenho.
   */
  onDecided?: (decided: Suggestion) => void;
  /**
   * Quanto histórico sustenta isto.
   *
   * Vem para dentro do cartão porque é aqui que ele serve para alguma
   * coisa: é a amostra que põe a fasquia onde ela está. Sozinho num
   * autocolante, três linhas acima, era um número que ninguém sabia
   * para que era.
   */
  sample?: { label: string; pct: number };
}) {
  // Quinze mercados e duas ordenações: não vale a memória de os guardar
  // entre desenhos nem o cuidado de manter as dependências certas.
  const decided = suggest({ ...props, label });
  const { call, pick, because, raised, avoid, avoidBecause } = decided;

  // Só quando há mercado e preço: sem isso não há nada que se possa
  // conferir depois, e o registo encheria de linhas por verificar.
  const mercado = pick?.market ?? null;
  const preco = pick?.price ?? null;
  useEffect(() => {
    if (!loading && mercado && preco) onDecided?.(decided);
    // A decisão muda quando o jogo muda, e é isso que a identifica.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mercado, preco, call, loading]);
  const tom = TOM[call];

  // As mesmas provas que entraram na decisão, agora à vista. Não é um
  // segundo juízo: é o primeiro, por dentro.
  const trial = tribunal(
    {
      record: props.record,
      blocked: props.blocked,
      patterns: props.patterns,
      absences: props.absences,
      teams: props.teams,
    },
    pick,
  );

  /** O que cada euro apostado devolve, pela nossa conta. É a margem. */
  const retorno =
    pick?.price && pick.price > 1 ? (pick.ours / 100) * pick.price - 1 : null;
  const aposta =
    pick?.price && pick.price > 1 ? getKellyPct(pick.ours, pick.price) : null;

  if (loading) {
    return (
      <section className="sl-card overflow-hidden">
        <div className="bg-muted/40 px-4 py-3.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Sugestão de IA
          </p>
          <div className="mt-2 flex items-center gap-2.5">
            <Loader2
              className="h-4 w-4 flex-none animate-spin text-muted-foreground"
              aria-hidden
            />
            <p className="text-[13px] font-semibold text-muted-foreground">
              A ver os preços, as baixas e o nosso registo…
            </p>
          </div>
          {sample && (
            <p className="sl-meta mt-1.5 text-[11px] leading-4">
              Histórico: {sample.label} ({sample.pct.toFixed(0)}%)
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="sl-card overflow-hidden">
      <div className={`px-4 py-3.5 ${tom.fundo}`}>
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Sugestão de IA
        </p>

        <div className="mt-1.5 flex items-baseline gap-3">
          <h2
            className={`min-w-0 flex-1 text-[17px] font-bold leading-6 ${tom.texto}`}
          >
            {pick ? label(pick.market) : "Não há nada aqui"}
          </h2>
          {pick && (
            <span
              className={`font-mono-data flex-none text-[20px] font-bold leading-6 ${
                pick.price ? tom.texto : "text-muted-foreground"
              }`}
              title={
                !pick.price
                  ? "O preço a que ficaria justo"
                  : pick.derived
                    ? "Ninguém cota a dupla hipótese: este preço sai exacto das três simples desta casa"
                    : "O preço mediano das casas"
              }
            >
              {pick.price
                ? `${pick.derived ? "≈" : ""}${odd(pick.price)}`
                : `justo ${odd(pick.fairPrice)}`}
            </span>
          )}
        </div>

        <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
          {because}
        </p>

        {pick && pick.marketPct !== null && (
          <div className="mt-2.5 space-y-1">
            <Bar who="Nós" pct={pick.ours} tone="bg-primary" />
            <Bar
              who="Mercado"
              pct={pick.marketPct}
              tone="bg-[hsl(var(--sl-cool))]"
            />
          </div>
        )}

        {pick && pick.price && retorno !== null && aposta !== null && (
          <div className="mt-2.5 grid grid-cols-4 gap-1.5">
            <Figure
              label="Odd"
              value={`${pick.derived ? "≈" : ""}${odd(pick.price)}`}
              note={pick.derived ? "deduzida" : "mediana"}
            />
            <Figure label="Justa" value={odd(pick.fairPrice)} note="o justo" />
            <Figure
              label="Retorno"
              value={`${retorno >= 0 ? "+" : "−"}${Math.abs(retorno * 100).toFixed(0)}%`}
              note="por euro"
              tone={
                retorno >= 0
                  ? "text-[hsl(var(--sl-green))]"
                  : "text-destructive"
              }
            />
            <Figure
              label="Aposta"
              value={aposta > 0 ? `${aposta.toFixed(1).replace(".", ",")}%` : "—"}
              note="da banca"
            />
          </div>
        )}

        {/* O raciocínio, por baixo da decisão e não dentro dela.
            A frase diz o que fazer e tem de caber num telemóvel; isto
            é o que me fez pedir mais do que o costume neste jogo, e é
            o que separa um juízo de um número do modelo. */}
        {raised.length > 0 && (
          <p
            className="sl-meta mt-1.5 text-[11px] leading-4"
            title="Razões para pedir mais a este jogo do que ao normal. Nenhuma delas o modelo vê."
          >
            Sou mais exigente neste jogo: {enumerate(raised.map((r) => r.what))}
            .
          </p>
        )}

        {sample && raised.length === 0 && (
          <p
            className="sl-meta mt-1.5 text-[11px] leading-4"
            title="Quantidade de histórico por trás da previsão, não a taxa de acerto dela"
          >
            Histórico: {sample.label} ({sample.pct.toFixed(0)}%)
          </p>
        )}
      </div>

      {/* As cinco provas que entraram na conta, cada uma com o seu voto.
          Não é um segundo juízo sobre o jogo — é o primeiro, por
          dentro. E quem não tem nada a dizer aparece a dizer isso,
          porque num tribunal a falta de prova não é prova de nada. */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="sl-meta flex-1 text-[10px] uppercase tracking-[0.12em]">
            Tribunal
          </p>
          <p className="font-mono-data text-[12px] font-bold text-foreground">
            {trial.favour}–{trial.against}
          </p>
        </div>

        <ul className="mt-1.5 space-y-1">
          {trial.judges.map((judge) => (
            <li key={judge.who} className="flex items-baseline gap-2">
              <span
                aria-hidden
                className={`mt-[1px] h-1.5 w-1.5 flex-none rounded-full ${
                  VOTO[judge.vote].ponto
                }`}
              />
              <p
                className={`min-w-0 flex-1 text-[11px] leading-4 ${
                  VOTO[judge.vote].texto
                }`}
              >
                <span className="font-semibold">{judge.who}</span>
                <span className="sl-meta"> · {judge.because}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>

      {avoid && (
        <div className="flex items-start gap-2.5 border-t border-border px-4 py-3">
          <Ban className="mt-0.5 h-3.5 w-3.5 flex-none text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-foreground">
              Evita {label(avoid.market)}
              {avoid.price ? (
                <span className="sl-meta font-mono-data font-normal">
                  {" "}
                  · {odd(avoid.price)}
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
              {avoidBecause}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
