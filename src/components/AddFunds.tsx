import { useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const field =
  "h-10 w-full rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30";

function toAmount(raw: string): number {
  return Number(raw.replace(",", ".")) || 0;
}

/**
 * Money put into the bankroll, or taken out, apart from betting.
 *
 * Without somewhere to say it, a deposit had to be swallowed by the bankroll
 * and read exactly like a win — the same number, moving the same way, for a
 * completely different reason. Saying it out loud is what keeps the profit
 * meaning anything.
 */
export function AddFunds({
  added,
  saving,
  onAdd,
}: {
  /** What has already been put in or taken out, over the challenge. */
  added: number;
  saving: boolean;
  onAdd: (amount: number, note: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [taking, setTaking] = useState(false);

  const value = toAmount(amount);
  const ready = value > 0;

  const submit = () => {
    if (!ready) return;
    onAdd(taking ? -value : value, note.trim() || null);
    setAmount("");
    setNote("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="sl-tap flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-primary"
      >
        <Wallet className="h-3.5 w-3.5" />
        {added === 0
          ? "Meti ou tirei dinheiro da banca"
          : `Dinheiro fora das apostas: ${added > 0 ? "+" : ""}${eur.format(added)}`}
      </button>
    );
  }

  return (
    <div className="space-y-2.5 rounded-xl bg-[hsl(var(--sl-surface))] p-3 ring-1 ring-border">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setTaking(false)}
          aria-pressed={!taking}
          className={`sl-tap h-9 flex-1 rounded-lg text-[11px] font-semibold ${
            taking
              ? "text-muted-foreground ring-1 ring-border"
              : "bg-primary text-primary-foreground"
          }`}
        >
          Meti dinheiro
        </button>
        <button
          type="button"
          onClick={() => setTaking(true)}
          aria-pressed={taking}
          className={`sl-tap h-9 flex-1 rounded-lg text-[11px] font-semibold ${
            taking
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground ring-1 ring-border"
          }`}
        >
          Tirei dinheiro
        </button>
      </div>

      <input
        inputMode="decimal"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="Quanto"
        aria-label="Valor a meter ou tirar da banca"
        className={`${field} font-mono-data`}
      />

      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Porquê (opcional)"
        aria-label="Nota sobre o movimento"
        maxLength={140}
        className={field}
      />

      <p className="sl-meta text-[11px] leading-5">
        Isto entra na banca mas fica de fora do lucro — senão meter dinheiro
        aparecia no ecrã como se o tivesses ganho.
      </p>

      <div className="flex gap-2">
        <Button
          className="sl-btn-primary h-10 flex-1 text-xs disabled:opacity-40"
          disabled={!ready || saving}
          onClick={submit}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Guardar"
          )}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="sl-tap h-10 flex-none rounded-xl px-4 text-xs font-semibold text-muted-foreground ring-1 ring-border"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
