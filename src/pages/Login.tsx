import { Button } from "@/components/ui/button";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { BarChart3, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { session, loading, signIn } = useAuth();
  const navigate = useNavigate();

  if (!loading && session) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signIn(email.trim(), password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative items-center justify-center p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsla(142,71%,45%,0.06)_0%,_transparent_70%)]" />
        <div className="relative max-w-md">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <span className="font-bold text-2xl text-foreground">ScoreLab</span>
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Bem-vindo de volta ao teu <span className="text-gradient-primary">edge</span>.
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Acede às tuas análises, acompanha as oportunidades diárias e mantém a tua banca otimizada.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-4">
            {[
              { label: "Mercados por Jogo", value: "15" },
              { label: "Simulações por Análise", value: "10 000" },
              { label: "Ligas Calibradas", value: "30+" },
              { label: "Modelo", value: "Dixon-Coles" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-white/[0.03] ring-1 ring-white/5 p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold font-mono-data text-foreground mt-1">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <span className="font-bold text-lg text-foreground">ScoreLab</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground">Entrar</h1>
          <p className="text-sm text-muted-foreground mt-1">Introduz as tuas credenciais para continuar.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-11 px-4 rounded-lg input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-foreground">Palavra-passe</label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">Esqueceste-te?</Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-4 rounded-lg input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            )}
            <Button type="submit" variant="hero" className="w-full" size="lg" disabled={submitting}>
              {submitting ? "A entrar..." : "Entrar"} <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Ainda não tens conta?{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">Criar conta</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
