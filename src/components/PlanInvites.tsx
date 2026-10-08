import { useState } from "react";
import { Loader2, MailOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  acceptInvite,
  declineInvite,
  type PendingInvite,
} from "@/lib/planStore";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** How long the invitation has been sitting there, in words. */
export function waitingFor(at: string, now = Date.now()): string {
  const when = new Date(at).getTime();
  if (Number.isNaN(when)) return "";

  const hours = Math.floor((now - when) / 3_600_000);
  if (hours < 1) return "agora mesmo";
  if (hours < 24) return hours === 1 ? "há 1 hora" : `há ${hours} horas`;

  const days = Math.floor(hours / 24);
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}

/**
 * Somebody asked you to join a challenge.
 *
 * This used to live inside a challenge's own page — which is a page about
 * challenges this person is already in, reached by picking one. An invitation
 * to a challenge they are not in had no reason ever to be on screen, so the
 * only way to find one was to be told out loud. It is now at the top of the
 * page the app opens on, and counted on the way in to the challenges.
 *
 * It also says what the challenge is before it is accepted: the money, the
 * target, the levels and who is already in. The server has to hand those over
 * because somebody invited is not a member yet and cannot read the plan.
 */
export function PlanInvites({
  invites,
  onAnswered,
}: {
  invites: PendingInvite[];
  /** Reload the challenges: accepting adds one, declining removes the card. */
  onAnswered: () => void;
}) {
  const [answering, setAnswering] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  if (invites.length === 0) return null;

  const answer = async (planId: string, accept: boolean) => {
    setAnswering(planId);
    setFailed(null);
    try {
      if (accept) await acceptInvite(planId);
      else await declineInvite(planId);
      onAnswered();
    } catch {
      setFailed(
        accept
          ? "Não deu para entrar no desafio. Tenta outra vez."
          : "Não deu para recusar agora. Tenta outra vez.",
      );
    } finally {
      setAnswering(null);
    }
  };

  return (
    <div className="space-y-2">
      {invites.map((invite) => {
        const busy = answering === invite.plan_id;

        return (
          <article
            key={invite.plan_id}
            className="sl-card overflow-hidden ring-1 ring-primary/40"
          >
            <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-primary/12 to-transparent px-4 py-2">
              <MailOpen className="h-3.5 w-3.5 flex-none text-primary" />
              <p className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                Convite
              </p>
              <p className="sl-meta flex-none text-[11px]">
                {waitingFor(invite.created_at)}
              </p>
            </div>

            <div className="px-4 py-3">
              <p className="text-[13.5px] leading-6 text-foreground">
                <span className="font-semibold">{invite.invited_by_name}</span>{" "}
                convidou-te para o{" "}
                <span className="font-semibold">{invite.plan_name}</span>.
              </p>

              {/* What it is, before saying yes. */}
              <p className="sl-meta mt-1 text-[11.5px] leading-5">
                {eur.format(Number(invite.starting_bankroll))} →{" "}
                {eur.format(Number(invite.target))} · {invite.days} níveis ·{" "}
                {invite.players === 1
                  ? "1 jogador lá dentro"
                  : `${invite.players} jogadores lá dentro`}
              </p>
              <p className="sl-meta mt-1 text-[11.5px] leading-5">
                Se aceitares, passam a ver as apostas um do outro e cada um
                segue com a sua banca.
              </p>

              {failed && (
                <p className="mt-2 text-[11.5px] font-medium text-destructive">
                  {failed}
                </p>
              )}

              <div className="mt-3 flex gap-2">
                <Button
                  className="sl-btn-primary h-10 flex-1 text-xs"
                  disabled={busy}
                  onClick={() => answer(invite.plan_id, true)}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Aceitar"
                  )}
                </Button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => answer(invite.plan_id, false)}
                  className="h-10 flex-none rounded-lg border border-border px-4 text-xs font-semibold text-muted-foreground disabled:opacity-40"
                >
                  Recusar
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
