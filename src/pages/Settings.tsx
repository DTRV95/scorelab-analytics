import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Loader2,
  Lock,
  LogOut,
  RotateCcw,
  Trophy,
  User,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanBoard } from "@/hooks/usePlanBoard";
import { summarise } from "@/lib/betAnalytics";
import { resetAllScorelabData } from "@/lib/persistenceSync";
import { fetchMyProfile, saveDisplayName, type MyProfile } from "@/lib/planStore";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const field =
  "h-10 w-full rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30";

/** The two letters a name comes down to, for the round mark. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function since(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function Card({
  title,
  icon: Icon,
  tone = "default",
  children,
}: {
  title: string;
  icon: React.ElementType;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <section
      className={
        tone === "danger"
          ? "rounded-2xl border border-destructive/25 bg-destructive/[0.04] p-4"
          : "sl-card p-4"
      }
    >
      <h2
        className={`mb-3 flex items-center gap-2 text-[13px] font-bold ${
          tone === "danger" ? "text-destructive" : "text-foreground"
        }`}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Who this person is, in the app.
 *
 * This page was the template's: "John Analyst", "john@example.com", a Pro
 * Plan at $29 a month, default Kelly fractions — all of it in English, none
 * of it wired to anything, including the buttons. What an account actually
 * has is a name that the other players see, an email, a password, and a
 * record built out of its own bets.
 */
export default function Settings() {
  const { user, signOut, updatePassword } = useAuth();
  const { bets, plans, loading } = usePlanBoard();

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState(false);

  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMyProfile()
      .then((found) => {
        if (cancelled || !found) return;
        setProfile(found);
        setName(found.display_name);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Built from the bets themselves, like everywhere else in the app.
  const record = useMemo(() => summarise(bets), [bets]);
  const running = plans.filter((plan) => !plan.ended_at).length;

  const changeName = async () => {
    const wanted = name.trim();
    if (!wanted || wanted === profile?.display_name) return;

    setSavingName(true);
    setSavedName(false);
    try {
      const saved = await saveDisplayName(wanted);
      setName(saved);
      setProfile((current) =>
        current ? { ...current, display_name: saved } : current,
      );
      setSavedName(true);
    } catch {
      toast({
        title: "O nome não ficou guardado",
        description: "Tenta outra vez daqui a pouco.",
        variant: "destructive",
      });
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async () => {
    if (password.length < 8) {
      toast({
        title: "Palavra-passe curta de mais",
        description: "Pelo menos oito caracteres.",
        variant: "destructive",
      });
      return;
    }
    if (password !== repeat) {
      toast({
        title: "As duas não são iguais",
        description: "Escreve a mesma palavra-passe nos dois campos.",
        variant: "destructive",
      });
      return;
    }

    setSavingPassword(true);
    const { error } = await updatePassword(password);
    setSavingPassword(false);

    if (error) {
      toast({
        title: "A palavra-passe não foi mudada",
        description: error,
        variant: "destructive",
      });
      return;
    }

    setPassword("");
    setRepeat("");
    toast({ title: "Palavra-passe mudada" });
  };

  const startFresh = async () => {
    setIsResetting(true);
    try {
      await resetAllScorelabData();
      toast({
        title: "Dados deste browser apagados",
        description:
          "Os desafios e as apostas continuam na tua conta — isto limpou só o que estava guardado aqui.",
      });
      window.setTimeout(() => window.location.reload(), 250);
    } catch {
      toast({
        title: "Não deu para apagar",
        description: "Tenta outra vez daqui a pouco.",
        variant: "destructive",
      });
      setIsResetting(false);
    }
  };

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-3"
      >
        <div>
          <h1 className="sl-section-title text-[15px]">O teu perfil</h1>
        </div>

        {/* Who the other players see, and what this account has done. */}
        <section className="sl-card overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-4">
            <span className="sl-figure flex h-12 w-12 flex-none items-center justify-center rounded-2xl text-[15px] text-white [background:var(--sl-gradient)]">
              {initials(profile?.display_name ?? name ?? "")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-foreground">
                {profile?.display_name ?? "—"}
              </p>
              {/* Wrapping, not truncated: an email cut off mid-domain and a
                  date cut off mid-year are two facts nobody can read. */}
              <p className="sl-meta text-[11.5px] leading-5">
                {profile?.email ?? user?.email ?? ""}
                {profile?.joined_at ? ` · desde ${since(profile.joined_at)}` : ""}
              </p>
            </div>
          </div>

          {!loading && (
            <div className="grid grid-cols-3 gap-px border-t border-border bg-border">
              {[
                {
                  label: "Desafios",
                  value: String(running),
                },
                {
                  label: "Apostas fechadas",
                  value: String(record.settled),
                },
                {
                  label: "Das apostas",
                  value: `${record.profit >= 0 ? "+" : ""}${eur.format(record.profit)}`,
                  tone:
                    record.profit > 0
                      ? "text-[hsl(var(--sl-green))]"
                      : record.profit < 0
                        ? "text-destructive"
                        : "",
                },
              ].map((cell) => (
                <div key={cell.label} className="bg-card px-3 py-2.5">
                  <p className="sl-meta text-[10px] uppercase tracking-[0.1em]">
                    {cell.label}
                  </p>
                  <p
                    className={`sl-figure mt-0.5 text-[14px] ${cell.tone ?? "text-foreground"}`}
                  >
                    {cell.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          <Link
            to="/dashboard/analises"
            className="sl-tap flex items-center gap-2 border-t border-border px-4 py-2.5"
          >
            <Trophy className="h-3.5 w-3.5 flex-none text-muted-foreground" />
            <span className="sl-meta min-w-0 flex-1 text-[12px]">
              O teu registo, por mercado e por preço
            </span>
            <ArrowRight className="h-3.5 w-3.5 flex-none text-muted-foreground" />
          </Link>
        </section>

        <Card title="O teu nome" icon={User}>
          <p className="sl-meta mb-2 text-[11.5px] leading-5">
            É este que aparece aos outros jogadores, nos desafios e nas
            classificações. Mudá-lo muda-o também nos desafios que já tens.
          </p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSavedName(false);
              }}
              maxLength={40}
              aria-label="O teu nome"
              className={field}
            />
            <Button
              className="sl-btn-primary h-10 flex-none px-4 text-xs disabled:opacity-40"
              disabled={
                savingName || !name.trim() || name.trim() === profile?.display_name
              }
              onClick={changeName}
            >
              {savingName ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : savedName ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                "Guardar"
              )}
            </Button>
          </div>
        </Card>

        <Card title="Palavra-passe" icon={Lock}>
          <div className="space-y-2">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nova palavra-passe"
              aria-label="Nova palavra-passe"
              className={field}
            />
            <input
              type="password"
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
              placeholder="Outra vez"
              aria-label="Repetir a palavra-passe"
              className={field}
            />
            <Button
              className="sl-btn-primary h-10 w-full text-xs disabled:opacity-40"
              disabled={savingPassword || !password || !repeat}
              onClick={changePassword}
            >
              {savingPassword ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Mudar a palavra-passe"
              )}
            </Button>
          </div>
        </Card>

        <Card title="Sessão" icon={LogOut}>
          <Button
            variant="outline"
            className="h-10 w-full text-xs"
            onClick={() => void signOut()}
          >
            Terminar sessão
          </Button>
        </Card>

        <Card title="Dados guardados neste browser" icon={RotateCcw} tone="danger">
          <p className="text-[12px] leading-6 text-muted-foreground">
            Limpa as análises guardadas, as definições de banca e as cópias
            locais deste dispositivo.{" "}
            <span className="font-semibold text-foreground">
              Os desafios e as apostas ficam na tua conta
            </span>{" "}
            — isto não apaga nada do que está no servidor.
          </p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="mt-3 h-10 w-full text-xs"
                disabled={isResetting}
              >
                {isResetting ? "A apagar..." : "Apagar os dados deste browser"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar o que está guardado aqui?</AlertDialogTitle>
                <AlertDialogDescription>
                  Análises guardadas, definições de banca e cópias locais deste
                  dispositivo. Os desafios, as apostas e a tua conta não são
                  tocados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isResetting}>
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={startFresh}
                  disabled={isResetting}
                >
                  {isResetting ? "A apagar..." : "Apagar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      </motion.div>
    </AppLayout>
  );
}
