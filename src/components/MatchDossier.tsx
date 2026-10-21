import { ClipboardList, ShieldAlert } from "lucide-react";
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

export function MatchDossier(props: DossierInput) {
  // Dez linhas e meia dúzia de comparações: não vale a memória de as
  // guardar entre desenhos nem o cuidado de manter as dependências certas.
  const dossier = buildDossier(props);
  const contra = objections(props, dossier);

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
