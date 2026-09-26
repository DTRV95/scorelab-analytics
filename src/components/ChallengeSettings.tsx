import { useState } from "react";
import { Loader2, Settings2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CHALLENGE_TEMPLATES,
  describeRules,
  parseRules,
  type ChallengeRules,
  type StakeBand,
} from "@/lib/challengeRules";
import {
  createPlan,
  deletePlan,
  leavePlan,
  updatePlanTerms,
  type PlanRecord,
} from "@/lib/planStore";

// Compact on purpose: this is a one-line summary, and "1 000 000 €" spelled
// out pushed the target off the end of it on a phone.
const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

interface Draft {
  name: string;
  startDate: string;
  startingBankroll: string;
  target: string;
  days: string;
  bands: StakeBand[];
  oddsMin: string;
  oddsMax: string;
  onePerDay: boolean;
  pause: string;
  oddsPlan: ChallengeRules["oddsPlan"];
}

function draftFromTemplate(index: number): Draft {
  const template = CHALLENGE_TEMPLATES[index];
  return {
    name: template.name,
    startDate: todayIso(),
    startingBankroll: String(template.startingBankroll),
    target: String(template.target),
    days: String(template.rules.days),
    bands: template.rules.stakeBands,
    oddsMin:
      template.rules.oddsMin === null ? "" : String(template.rules.oddsMin),
    oddsMax:
      template.rules.oddsMax === null ? "" : String(template.rules.oddsMax),
    onePerDay: template.rules.onePerDay,
    pause:
      template.rules.lossStreakPause === null
        ? ""
        : String(template.rules.lossStreakPause),
    oddsPlan: template.rules.oddsPlan,
  };
}

function draftFromPlan(plan: PlanRecord): Draft {
  const rules = parseRules(plan.rules, plan.days);
  return {
    name: plan.name,
    startDate: plan.start_date ?? "",
    startingBankroll: String(plan.starting_bankroll),
    target: String(plan.target),
    days: String(rules.days),
    bands: rules.stakeBands,
    oddsMin: rules.oddsMin === null ? "" : String(rules.oddsMin),
    oddsMax: rules.oddsMax === null ? "" : String(rules.oddsMax),
    onePerDay: rules.onePerDay,
    pause: rules.lossStreakPause === null ? "" : String(rules.lossStreakPause),
    oddsPlan: rules.oddsPlan,
  };
}

function num(value: string): number {
  return Number(value.replace(",", "."));
}

function rulesFromDraft(draft: Draft): ChallengeRules {
  return parseRules({
    days: num(draft.days),
    stakeBands: draft.bands,
    oddsMin: draft.oddsMin.trim() === "" ? null : num(draft.oddsMin),
    oddsMax: draft.oddsMax.trim() === "" ? null : num(draft.oddsMax),
    onePerDay: draft.onePerDay,
    lossStreakPause: draft.pause.trim() === "" ? null : num(draft.pause),
    oddsPlan: draft.oddsPlan,
  });
}

function terms(draft: Draft) {
  const rules = rulesFromDraft(draft);
  return {
    name: draft.name.trim(),
    startDate: draft.startDate || null,
    startingBankroll: num(draft.startingBankroll),
    target: num(draft.target),
    days: rules.days,
    rules,
  };
}

function isValid(draft: Draft): boolean {
  const parsed = terms(draft);
  return (
    parsed.name.length > 0 &&
    Number.isFinite(parsed.startingBankroll) &&
    parsed.startingBankroll > 0 &&
    Number.isFinite(parsed.target) &&
    parsed.target > parsed.startingBankroll
  );
}

const field =
  "mt-1 h-10 w-full rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

function Fields({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (next: Draft) => void;
}) {
  const single = draft.bands.length === 1;

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="sl-meta text-[11px]">Nome do desafio</span>
        <input
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          placeholder="Plano Milhão"
          className={field}
        />
      </label>

      <label className="block">
        <span className="sl-meta text-[11px]">Data de começo</span>
        <input
          type="date"
          value={draft.startDate}
          onChange={(event) =>
            onChange({ ...draft, startDate: event.target.value })
          }
          style={{ colorScheme: "light" }}
          className={`${field} font-mono-data`}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="sl-meta text-[11px]">Banca inicial (€)</span>
          <input
            inputMode="decimal"
            value={draft.startingBankroll}
            onChange={(event) =>
              onChange({ ...draft, startingBankroll: event.target.value })
            }
            placeholder="10"
            className={`${field} font-mono-data`}
          />
        </label>
        <label className="block">
          <span className="sl-meta text-[11px]">Objetivo (€)</span>
          <input
            inputMode="decimal"
            value={draft.target}
            onChange={(event) =>
              onChange({ ...draft, target: event.target.value })
            }
            placeholder="1000000"
            className={`${field} font-mono-data`}
          />
        </label>
      </div>

      <div className="rounded-lg border border-border bg-[hsl(var(--sl-surface))] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Regras
        </p>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="sl-meta text-[11px]">Dias</span>
            <input
              inputMode="numeric"
              value={draft.days}
              onChange={(event) =>
                onChange({ ...draft, days: event.target.value })
              }
              className={`${field} font-mono-data`}
            />
          </label>

          {single ? (
            <label className="block">
              <span className="sl-meta text-[11px]">% da banca por dia</span>
              <input
                inputMode="decimal"
                value={String(Math.round(draft.bands[0].pct * 100))}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    bands: [
                      {
                        untilDay: null,
                        pct: Math.min(
                          1,
                          Math.max(0.01, num(event.target.value) / 100 || 0.1),
                        ),
                      },
                    ],
                  })
                }
                className={`${field} font-mono-data`}
              />
            </label>
          ) : (
            <div>
              <span className="sl-meta text-[11px]">% da banca por dia</span>
              <div
                className={`${field} flex items-center justify-between gap-2`}
              >
                <span className="font-mono-data text-[13px] text-foreground">
                  {draft.bands
                    .map((band) => `${Math.round(band.pct * 100)}%`)
                    .join(" → ")}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...draft,
                      bands: [{ untilDay: null, pct: draft.bands[0].pct }],
                    })
                  }
                  className="sl-meta flex-none text-[10px] underline"
                >
                  fixar
                </button>
              </div>
            </div>
          )}
        </div>

        {!single && (
          <p className="sl-meta mt-1 text-[10px] leading-relaxed">
            A percentagem desce ao longo do desafio, como no Plano Milhão.
            Carrega em &ldquo;fixar&rdquo; para usares a mesma todos os dias.
          </p>
        )}

        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="sl-meta text-[11px]">Odd mínima</span>
            <input
              inputMode="decimal"
              value={draft.oddsMin}
              onChange={(event) =>
                onChange({ ...draft, oddsMin: event.target.value })
              }
              placeholder="sem limite"
              className={`${field} font-mono-data`}
            />
          </label>
          <label className="block">
            <span className="sl-meta text-[11px]">Odd máxima</span>
            <input
              inputMode="decimal"
              value={draft.oddsMax}
              onChange={(event) =>
                onChange({ ...draft, oddsMax: event.target.value })
              }
              placeholder="sem limite"
              className={`${field} font-mono-data`}
            />
          </label>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="sl-meta text-[11px]">Parar após N perdas</span>
            <input
              inputMode="numeric"
              value={draft.pause}
              onChange={(event) =>
                onChange({ ...draft, pause: event.target.value })
              }
              placeholder="nunca"
              className={`${field} font-mono-data`}
            />
          </label>
          <label className="mt-1 flex items-center gap-2 self-end rounded-lg border border-border bg-card px-3 py-2.5">
            <input
              type="checkbox"
              checked={draft.onePerDay}
              onChange={(event) =>
                onChange({ ...draft, onePerDay: event.target.checked })
              }
              className="h-4 w-4 flex-none accent-[hsl(var(--primary))]"
            />
            <span className="text-[12px] text-foreground">
              Uma aposta por dia
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

/**
 * Starting a challenge.
 *
 * A template fills every field at once, because nobody wants to invent a stake
 * curve from nothing — and every field stays editable afterwards, because the
 * templates are examples, not the only shapes a challenge can take.
 */
export function CreateChallenge({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [templateIndex, setTemplateIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => draftFromTemplate(0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = isValid(draft);

  const pick = (index: number) => {
    setTemplateIndex(index);
    setDraft(draftFromTemplate(index));
  };

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await createPlan(terms(draft));
      setOpen(false);
      onCreated();
    } catch {
      setError("Não foi possível criar o desafio.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-primary"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Criar um desafio
      </button>
    );
  }

  return (
    <section className="sl-card overflow-hidden">
      <div className="border-b border-border px-4 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Novo desafio
        </h2>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          Escolhe um modelo para preencher tudo, e muda o que quiseres.
        </p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto px-4 py-3">
        {CHALLENGE_TEMPLATES.map((template, index) => (
          <button
            key={template.key}
            type="button"
            onClick={() => pick(index)}
            className={`flex-none rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
              index === templateIndex
                ? "bg-primary text-white"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {template.name}
          </button>
        ))}
      </div>

      <p className="sl-meta px-4 pb-2 text-[11px] leading-relaxed">
        {CHALLENGE_TEMPLATES[templateIndex].blurb}
      </p>

      <div className="space-y-2 p-4 pt-0">
        <Fields draft={draft} onChange={setDraft} />
        <Button
          className="sl-btn-primary h-10 w-full text-xs disabled:opacity-40"
          disabled={!valid || saving}
          onClick={submit}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Criar desafio"
          )}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="sl-meta w-full text-[11px]"
        >
          Cancelar
        </button>
        {!valid && draft.name.trim().length > 0 && (
          <p className="sl-meta text-[11px]">
            O objetivo tem de ser maior do que a banca inicial.
          </p>
        )}
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
    </section>
  );
}

/** Deleting takes everyone's history with it, so the name has to be typed. */
function DangerZone({
  plan,
  isOwner,
  onGone,
}: {
  plan: PlanRecord;
  isOwner: boolean;
  onGone: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setWorking(true);
    setError(null);
    try {
      await (isOwner ? deletePlan(plan.id) : leavePlan(plan.id));
      onGone();
    } catch {
      setError(
        isOwner
          ? "Não foi possível apagar. Só quem criou o desafio o pode fazer."
          : "Não foi possível sair deste desafio.",
      );
    } finally {
      setWorking(false);
    }
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 py-2.5 text-xs font-semibold text-destructive transition hover:bg-destructive/5"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {isOwner ? "Apagar este desafio" : "Sair deste desafio"}
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <p className="text-[12px] leading-relaxed text-foreground">
        {isOwner ? (
          <>
            Isto apaga o desafio e <strong>todas as apostas</strong>, tuas e de
            quem entrou contigo. Não há forma de voltar atrás. Escreve{" "}
            <strong>{plan.name}</strong> para confirmar.
          </>
        ) : (
          <>
            Sais do desafio e as <strong>tuas</strong> apostas são apagadas. O
            desafio continua para quem ficar.
          </>
        )}
      </p>

      {isOwner && (
        <input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={plan.name}
          aria-label="Escrever o nome do desafio para confirmar"
          className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/30"
        />
      )}

      <div className="flex gap-2">
        <Button
          className="h-10 flex-1 bg-destructive text-xs text-white hover:bg-destructive/90 disabled:opacity-40"
          disabled={working || (isOwner && typed.trim() !== plan.name)}
          onClick={run}
        >
          {working ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isOwner ? (
            "Apagar de vez"
          ) : (
            "Sair"
          )}
        </Button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setTyped("");
          }}
          className="h-10 flex-none rounded-lg border border-border px-4 text-xs font-semibold text-muted-foreground"
        >
          Cancelar
        </button>
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

/** A challenge's terms and rules, changeable only by whoever created it. */
export function ChallengeSettings({
  plan,
  isOwner,
  onSaved,
  onGone,
}: {
  plan: PlanRecord;
  isOwner: boolean;
  onSaved: () => void;
  onGone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFromPlan(plan));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = isValid(draft);
  const rules = parseRules(plan.rules, plan.days);

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await updatePlanTerms(plan.id, terms(draft));
      setOpen(false);
      onSaved();
    } catch {
      setError(
        "Não foi possível guardar. Só quem criou o desafio pode mudá-lo.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="sl-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <Settings2 className="h-4 w-4 flex-none text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">
            Regras deste desafio
          </p>
          <p className="sl-meta truncate text-[11px]">
            {plan.start_date
              ? `Começa a ${plan.start_date.split("-").reverse().join("/")}`
              : "Sem data de começo"}{" "}
            · {eur.format(plan.starting_bankroll)} → {eur.format(plan.target)}
          </p>
        </div>
        <span className="sl-meta flex-none text-[11px]">
          {open ? "Fechar" : isOwner ? "Alterar" : "Ver"}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-border p-4">
          {isOwner ? (
            <>
              <Fields draft={draft} onChange={setDraft} />
              <p className="sl-meta text-[11px] leading-relaxed">
                Mudar a banca inicial só afeta quem ainda não apostou. Quem já
                começou mantém o número contra o qual a banca dele foi medida.
              </p>
              <Button
                className="sl-btn-primary h-10 w-full text-xs disabled:opacity-40"
                disabled={!valid || saving}
                onClick={save}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Guardar"
                )}
              </Button>
              {error && <p className="text-[11px] text-destructive">{error}</p>}
            </>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {describeRules(rules)}. Só quem criou o desafio pode mudar isto.
            </p>
          )}

          <div className="border-t border-border pt-3">
            <DangerZone plan={plan} isOwner={isOwner} onGone={onGone} />
          </div>
        </div>
      )}
    </section>
  );
}
