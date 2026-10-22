import type { ReactNode } from "react";
import { ClipboardList, Newspaper, ShieldAlert, UserMinus } from "lucide-react";
import { SectionHeader } from "@/components/Section";
import {
  describeAbsence,
  sortAbsences,
  statusLabel,
} from "@/lib/absences";
import {
  buildDossier,
  enumerate,
  objections,
  type DossierInput,
  type DossierLine,
} from "@/lib/matchDossier";

/**
 * O que sabemos deste jogo, e o que joga contra.
 *
 * Duas perguntas que a página respondia a nenhuma: com que informação é que
 * este número foi feito, e quem é que argumenta do outro lado. As linhas em
 * falta ficam à vista, em cinzento, porque são elas que dizem o quanto o
 * número vale.
 */

function Line({ line }: { line: DossierLine }) {
  const falta = line.value === null;

  return (
    <div className="flex items-baseline gap-2">
      <span
        aria-hidden
        className={`mt-[1px] h-1.5 w-1.5 flex-none rounded-full ${
          falta
            ? line.heavy
              ? "bg-destructive/50"
              : "bg-muted-foreground/35"
            : "bg-foreground/45"
        }`}
      />
      <p className="min-w-0 flex-1 text-[12px] leading-5">
        <span className={falta ? "text-muted-foreground" : "text-foreground"}>
          {line.label}
        </span>{" "}
        <span
          className={
            falta ? "text-muted-foreground/70 italic" : "font-semibold text-foreground"
          }
        >
          {falta ? line.missing : line.value}
        </span>
      </p>
    </div>
  );
}

function Bloco({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Newspaper;
  title: string;
  children: ReactNode;
}) {
  // min-w-0: sem isto, uma célula de grelha cresce com o conteúdo em vez
  // de o cortar, e um título comprido saía pela borda fora sem sequer
  // mostrar as reticências.
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      {children}
    </div>
  );
}

export function MatchDossier(props: DossierInput) {
  // Dez linhas e meia dúzia de comparações: não vale a memória de as
  // guardar entre desenhos nem o cuidado de manter as dependências certas.
  const dossier = buildDossier(props);
  const contra = objections(props, dossier);
  // Só as equipas que têm alguma coisa: um nome com uma lista vazia por
  // baixo ocupa espaço para não dizer nada.
  const noticias = Object.entries(props.news ?? {}).filter(
    ([, items]) => items.length > 0,
  );

  return (
    <section className="sl-card overflow-hidden">
      <SectionHeader
        icon={ClipboardList}
        title="O que sabemos deste jogo"
        note={
          dossier.heavyMissing.length > 0
            ? `Sabemos ${dossier.known} de ${dossier.total} coisas, e falta o que mais pesa: ${enumerate(
                dossier.heavyMissing,
              )}.`
            : `Sabemos ${dossier.known} de ${dossier.total} coisas.`
        }
        className="border-b border-border px-4 py-3"
      />

      {/* Duas colunas no ecrã grande; no telemóvel uma só, que a dez linhas
          lado a lado o que falta deixava de se ler como uma lista. */}
      <div className="grid gap-x-6 gap-y-1.5 px-4 py-3 md:grid-cols-2">
        {dossier.lines.map((line) => (
          <Line key={line.key} line={line} />
        ))}
      </div>

      {(props.absences || noticias.length > 0) && (
        <div className="grid gap-4 border-t border-border px-4 py-3 md:grid-cols-2">
          {props.teams && props.absences && (
            <Bloco icon={UserMinus} title="Quem está de fora">
              {[props.teams.home, props.teams.away].map((side) => {
                const lista = sortAbsences(props.absences?.[side] ?? []);
                return (
                  <div key={side} className="space-y-0.5">
                    <p className="text-[12px] font-semibold text-foreground">
                      {side}
                    </p>
                    {lista.length === 0 ? (
                      <p className="text-[12px] leading-5 text-muted-foreground">
                        ninguém, pelo que se sabe
                      </p>
                    ) : (
                      lista.map((player) => {
                        const duvida =
                          statusLabel(player.status) === "em dúvida";
                        return (
                          /* Texto corrido com entrada pendente, não uma
                             grelha: em flex, o motivo quebrava para
                             baixo do próprio motivo e o "volta a 10 nov"
                             ficava pendurado a meio da linha. */
                          <p
                            key={player.name}
                            className="pl-3.5 text-[12px] leading-5 [text-indent:-0.875rem]"
                          >
                            <span
                              aria-hidden
                              className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                                duvida ? "bg-muted-foreground/40" : "bg-destructive/70"
                              }`}
                            />
                            <span className="text-foreground">{player.name}</span>{" "}
                            <span className="sl-meta text-[11px]">
                              {[player.position, ...describeAbsence(player)]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </p>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </Bloco>
          )}

          {noticias.length > 0 && (
            <Bloco icon={Newspaper} title="Notícias da semana">
              {noticias.map(([side, items]) => (
                <div key={side} className="space-y-1">
                  <p className="text-[12px] font-semibold text-foreground">
                    {side}
                  </p>
                  {items.slice(0, 3).map((item) => (
                    <a
                      key={item.link || item.title}
                      href={item.link}
                      target="_blank"
                      rel="noreferrer noopener"
                      /* Sem truncate: um título cortado a meio não se lê,
                         e ler o título é a razão de isto estar aqui. Duas
                         linhas chegam para os títulos todos que vi, e o
                         line-clamp trava os que não chegarem. */
                      className="sl-tap block text-[12px] leading-5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      <span className="line-clamp-2">{item.title}</span>
                      {item.source ? (
                        <span className="sl-meta block text-[10px] uppercase tracking-[0.1em]">
                          {item.source}
                        </span>
                      ) : null}
                    </a>
                  ))}
                </div>
              ))}
            </Bloco>
          )}
        </div>
      )}

      {contra.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" />
            O que joga contra
          </p>
          <ul className="mt-2 space-y-1.5">
            {contra.map((item) => (
              <li
                key={item.key}
                className={`border-l-2 pl-2.5 text-[12px] leading-5 ${
                  item.grave
                    ? "border-destructive text-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
