import { useCallback, useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchPlanInvites,
  invitePlayer,
  type InviteOutcome,
  type PlanInvite,
  type PlanMember,
} from "@/lib/planStore";

const OUTCOME_MESSAGE: Record<InviteOutcome, string> = {
  invited:
    "Convite enviado. Aparece na conta dele assim que abrir os desafios.",
  already_member: "Essa pessoa já está neste desafio.",
  no_account: "Não há nenhuma conta registada com esse email.",
};

/**
 * Who is in the plan, and how someone else gets in.
 *
 * Membership used to be set by hand in the database. An invitation is the
 * honest version: the other person has to have an account and has to say yes,
 * and until they do they cannot read a single row of the plan.
 */
export function PlanPlayers({
  planId,
  members,
  onChanged,
}: {
  planId: string;
  members: PlanMember[];
  onChanged: () => void;
}) {
  const [invites, setInvites] = useState<PlanInvite[]>([]);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "good" | "bad";
    text: string;
  } | null>(null);

  const refresh = useCallback(() => {
    fetchPlanInvites(planId)
      .then(setInvites)
      .catch(() => undefined);
  }, [planId]);

  useEffect(refresh, [refresh]);

  const send = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;

    setSending(true);
    setFeedback(null);
    try {
      const outcome = await invitePlayer(planId, trimmed);
      setFeedback({
        tone: outcome === "invited" ? "good" : "bad",
        text: OUTCOME_MESSAGE[outcome],
      });
      if (outcome === "invited") {
        setEmail("");
        refresh();
        onChanged();
      }
    } catch {
      setFeedback({ tone: "bad", text: "Não foi possível enviar o convite." });
    } finally {
      setSending(false);
    }
  };

  const pending = invites.filter((invite) => invite.status === "pending");
  const declined = invites.filter((invite) => invite.status === "declined");

  // With nobody waiting on an answer, this card would only repeat the names
  // already standing above it, so all that is left of it is the way in.
  if (pending.length === 0 && declined.length === 0 && !inviting) {
    return (
      <button
        type="button"
        onClick={() => setInviting(true)}
        className="sl-card flex w-full items-center justify-center gap-2 py-3 text-xs font-semibold text-primary"
      >
        <UserPlus className="h-3.5 w-3.5" strokeWidth={2.1} />
        Convidar alguém
      </button>
    );
  }

  return (
    <section className="sl-card overflow-hidden">
      <div className="border-b border-border px-4 py-3.5">
        <h2 className="text-sm font-bold text-foreground">
          Quem está no desafio
        </h2>
      </div>

      <div className="divide-y divide-border">
        {members.map((member) => (
          <div
            key={member.user_id}
            className="flex items-center gap-3 px-4 py-2.5"
          >
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
              {member.display_name.slice(0, 1).toUpperCase()}
            </span>
            <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
              {member.display_name}
            </p>
            <span className="sl-pill sl-pill-win flex-none">A jogar</span>
          </div>
        ))}

        {pending.map((invite) => (
          <div
            key={invite.invited_user_id}
            className="flex items-center gap-3 px-4 py-2.5"
          >
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
              {invite.display_name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">
                {invite.display_name}
              </p>
              <p className="sl-meta truncate text-[11px]">{invite.email}</p>
            </div>
            <span className="sl-pill sl-pill-open flex-none">À espera</span>
          </div>
        ))}

        {declined.map((invite) => (
          <div
            key={invite.invited_user_id}
            className="flex items-center gap-3 px-4 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-muted-foreground">
                {invite.display_name}
              </p>
            </div>
            <span className="sl-pill sl-pill-muted flex-none">Recusou</span>
          </div>
        ))}
      </div>

      {/* Inviting happens once and then never again, so the form does not sit
          open taking a third of a phone screen for the rest of the challenge. */}
      {!inviting ? (
        <button
          type="button"
          onClick={() => setInviting(true)}
          className="flex w-full items-center justify-center gap-2 border-t border-border py-3 text-xs font-semibold text-primary"
        >
          <UserPlus className="h-3.5 w-3.5" strokeWidth={2.1} />
          Convidar alguém
        </button>
      ) : (
        <div className="space-y-2 border-t border-border p-4">
          <p className="text-xs leading-6 text-muted-foreground">
            Convida por email quem já tem conta no ScoreLab. Só entra depois de
            aceitar, e cada um mantém a sua banca.
          </p>
          <label className="block">
            <span className="sl-meta text-[11px]">
              Email de quem queres juntar
            </span>
            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") send();
              }}
              placeholder="irmao@exemplo.com"
              className="mt-1 h-10 w-full rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <Button
            className="sl-btn-primary h-10 w-full gap-2 text-xs disabled:opacity-40"
            disabled={!email.trim() || sending}
            onClick={send}
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <UserPlus className="h-3.5 w-3.5" strokeWidth={2.1} />
                Convidar
              </>
            )}
          </Button>

          {feedback && (
            <p
              className={`text-[11px] leading-relaxed ${
                feedback.tone === "good"
                  ? "text-[hsl(var(--sl-green))]"
                  : "text-destructive"
              }`}
            >
              {feedback.text}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
