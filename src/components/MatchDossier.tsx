import type { ReactNode } from "react";
import { ClipboardList, Newspaper, ShieldAlert, UserMinus } from "lucide-react";
import { SectionHeader } from "@/components/Section";
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

/** Um ausente numa linha: o nome e o que lhe sabemos, sem repetições. */
function describe(player: {
  name: string;
  status: string;
  reason?: string;
  back?: string;
}): string {
  const detalhe = [player.status, player.reason]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    // "out, out" acontece quando o motivo repete o estado.
    .filter((part, index, all) => all.indexOf(part) === index);

  return detalhe.length ? `${player.name} (${detalhe.join(", ")})` : player.name;
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
                const lista = props.absences?.[side] ?? [];
                return (
                  <p key={side} className="text-[12px] leading-5">
                    <span className="font-semibold text-foreground">{side}</span>{" "}
                    <span className="text-muted-foreground">
                      {lista.length === 0
                        ? "ninguém, pelo que se sabe"
                        : lista.map(describe).join(", ")}
                    </span>
                  </p>
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
                      className="sl-tap block truncate text-[12px] leading-5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      {item.title}
                      {item.source ? (
                        <span className="sl-meta"> · {item.source}</span>
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
