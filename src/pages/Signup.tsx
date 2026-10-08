import { AuthAside } from "@/components/AuthAside";
import { Button } from "@/components/ui/button";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { BarChart3, ArrowRight, MailCheck } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const { session, loading, signUp } = useAuth();
  const navigate = useNavigate();

  if (!loading && session && !awaitingConfirmation) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("A palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }
    setSubmitting(true);
    const result = await signUp(name.trim(), email.trim(), password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      setAwaitingConfirmation(true);
      return;
    }
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AuthAside
        title="Dez euros e um desafio."
        lead="Escolhes um modelo, a aplicação diz-te quanto apostar e a que odd em cada nível, e fecha os resultados sozinha."
        points={[
          "Conta gratuita, sem cartão e sem casa de apostas ligada",
          "Dez desafios prontos, do mais fácil ao que quase nunca sai",
          "Joga sozinho, ou convida alguém para o mesmo desafio",
        ]}
      />

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-black text-white"
              style={{ background: "var(--sl-gradient)" }}
            >
              SL
            </span>
            <span className="text-[15px] font-black tracking-[-0.02em] text-foreground">
              ScoreLab
            </span>
          </Link>

          {awaitingConfirmation ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MailCheck className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Verifica o teu email</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Enviámos um link de confirmação para <strong className="text-foreground">{email}</strong>.
                Confirma o teu endereço e depois inicia sessão.
              </p>
              <Link to="/login" className="mt-6 inline-block text-sm text-primary hover:underline font-medium">
                Voltar ao login
              </Link>
            </div>
          ) : (
          <>
          <h1 className="text-2xl font-bold text-foreground">Criar conta</h1>
          <p className="text-sm text-muted-foreground mt-1">Cria a tua conta para manteres as análises sincronizadas e seguras.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="O teu nome" className="w-full h-11 px-4 rounded-lg input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full h-11 px-4 rounded-lg input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Palavra-passe</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full h-11 px-4 rounded-lg input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            )}
            <Button type="submit" variant="hero" className="w-full" size="lg" disabled={submitting}>
              {submitting ? "A criar conta..." : "Criar Conta"} <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Já tens conta?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">Entrar</Link>
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
