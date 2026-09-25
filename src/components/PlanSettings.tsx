import { useState } from "react";
import { CalendarDays, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPlan, updatePlanTerms, type PlanRecord } from "@/lib/planStore";

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
}

function parse(draft: Draft) {
  return {
    name: draft.name.trim(),
    startDate: draft.startDate || null,
    startingBankroll: Number(draft.startingBankroll.replace(",", ".")),
    target: Number(draft.target.replace(",", ".")),
  };
}

function Fields({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (next: Draft) => void;
}) {
  const field =
    "mt-1 h-10 w-full rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="sl-meta text-[11px]">Nome do plano</span>
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
          onChange={(event) => onChange({ ...draft, startDate: event.target.value })}
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
            onChange={(event) => onChange({ ...draft, target: event.target.value })}
            placeholder="1000000"
            className={`${field} font-mono-data`}
          />
        </label>
      </div>
    </div>
  );
}

/**
 * Starting a plan from the app instead of from the database.
 *
 * The start date is not decoration: it is what lets the plan know which day
 * today is, rather than inferring it from how many bets happen to have been
 * placed.
 */
export function CreatePlan({ onCreated }: { onCreated: () => void }) {
  const [draft, setDraft] = useState<Draft>({
    name: "Plano Milhão",
    startDate: todayIso(),
    startingBankroll: "10",
    target: "1000000",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const terms = parse(draft);
  const valid =
    terms.name.length > 0 &&
    Number.isFinite(terms.startingBankroll) &&
    terms.startingBankroll > 0 &&
    Number.isFinite(terms.target) &&
    terms.target > terms.startingBankroll;

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await createPlan(terms);
      onCreated();
    } catch {
      setError("Não foi possível criar o plano.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="sl-card overflow-hidden">
      <div className="border-b border-border px-4 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <CalendarDays className="h-4 w-4 text-primary" />
          Começar um plano
        </h2>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          Escolhe o dia em que começa e com quanto. Depois convidas quem quiseres,
          e cada pessoa segue com a sua banca.
        </p>
      </div>
      <div className="space-y-2 p-4">
        <Fields draft={draft} onChange={setDraft} />
        <Button
          className="sl-btn-primary h-10 w-full text-xs disabled:opacity-40"
          disabled={!valid || saving}
          onClick={submit}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Criar plano"}
        </Button>
        {!valid && terms.name.length > 0 && (
          <p className="sl-meta text-[11px]">
            O objetivo tem de ser maior do que a banca inicial.
          </p>
        )}
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
    </section>
  );
}

/** The plan's terms, changeable only by whoever created it. */
export function PlanSettings({
  plan,
  onSaved,
}: {
  plan: PlanRecord;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    name: plan.name,
    startDate: plan.start_date ?? "",
    startingBankroll: String(plan.starting_bankroll),
    target: String(plan.target),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const terms = parse(draft);
  const valid =
    terms.name.length > 0 &&
    Number.isFinite(terms.startingBankroll) &&
    terms.startingBankroll > 0 &&
    Number.isFinite(terms.target) &&
    terms.target > terms.startingBankroll;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await updatePlanTerms(plan.id, terms);
      setOpen(false);
      onSaved();
    } catch {
      setError("Não foi possível guardar. Só quem criou o plano pode mudá-lo.");
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
            Termos do plano
          </p>
          <p className="sl-meta truncate text-[11px]">
            {plan.start_date
              ? `Começa a ${plan.start_date.split("-").reverse().join("/")}`
              : "Sem data de começo"}{" "}
            · {eur.format(plan.starting_bankroll)} → {eur.format(plan.target)}
          </p>
        </div>
        <span className="sl-meta flex-none text-[11px]">
          {open ? "Fechar" : "Alterar"}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-border p-4">
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
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar"}
          </Button>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>
      )}
    </section>
  );
}
