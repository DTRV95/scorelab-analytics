import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Target,
  Shield,
  Zap,
  Clock,
  Download,
  BookmarkCheck,
  ArrowRight,
  ChevronRight,
  Radar,
  Brain,
  Dices,
  Scale,
  Crosshair,
} from "lucide-react";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.4, 0, 0.2, 1] as const },
  }),
};

const features = [
  { icon: BarChart3, title: "Motor Probabilístico Poisson", desc: "Modela os desfechos do jogo com distribuições estatísticas avançadas." },
  { icon: TrendingUp, title: "Deteção de Apostas de Valor", desc: "Compara as probabilidades do modelo com as odds do mercado para encontrar edge." },
  { icon: Target, title: "Calculadora de Stake (Kelly)", desc: "Dimensiona a entrada ideal com base no edge e na tua banca." },
  { icon: Shield, title: "Índice de Confiança", desc: "Medidor de confiança 0–10 sustentado em sinais de qualidade dos dados." },
  { icon: Clock, title: "Histórico de Análises", desc: "Acompanha e revê todas as análises que fizeste." },
  { icon: Zap, title: "Painel Diário de Edge", desc: "Oportunidades do dia pré-analisadas e ordenadas por valor." },
  { icon: Download, title: "Exportação para Excel", desc: "Descarrega análises e relatórios em formatos estruturados." },
  { icon: BookmarkCheck, title: "Análises Guardadas", desc: "Guarda e organiza as tuas análises mais importantes." },
];

const steps = [
  { num: "01", title: "Introduz os Dados do Jogo", desc: "Estatísticas das equipas, forma recente e odds do mercado." },
  { num: "02", title: "Corre o Modelo", desc: "O motor Poisson calcula as probabilidades reais." },
  { num: "03", title: "Deteta o Valor", desc: "Compara modelo e mercado para encontrar odds mal avaliadas." },
  { num: "04", title: "Dimensiona a Stake", desc: "O critério de Kelly otimiza a tua entrada." },
];

const radarPreview: Array<{ home: string; away: string; league: string; market: string; odds: number; modelProb: number; edge: number; conf: number; decision: "Apostar" | "Cautela" | "Não Apostar"; tag?: string; best?: boolean }> = [
  { home: "Arsenal", away: "Chelsea", league: "Premier League", market: "Mais de 2.5", odds: 1.80, modelProb: 67.4, edge: 11.8, conf: 9, decision: "Apostar", tag: "Expetativa de muitos golos", best: true },
  { home: "Liverpool", away: "Man City", league: "Premier League", market: "Ambas Marcam", odds: 1.75, modelProb: 62.1, edge: 5.0, conf: 7, decision: "Apostar", tag: "Forte concordância do modelo" },
  { home: "Barcelona", away: "Real Madrid", league: "La Liga", market: "Mais de 3.5", odds: 2.80, modelProb: 42.3, edge: 6.6, conf: 7, decision: "Apostar" },
  { home: "Bayern", away: "Dortmund", league: "Bundesliga", market: "Mais de 2.5", odds: 1.55, modelProb: 72.8, edge: 8.3, conf: 8, decision: "Apostar", tag: "Forte concordância do modelo" },
  { home: "PSG", away: "Lyon", league: "Ligue 1", market: "Ambas Marcam", odds: 1.90, modelProb: 58.4, edge: 5.8, conf: 6, decision: "Cautela" },
  { home: "Juventus", away: "AC Milan", league: "Serie A", market: "Menos de 2.5", odds: 1.95, modelProb: 54.2, edge: 2.9, conf: 5, decision: "Cautela" },
];

const thinkingSteps = [
  { icon: Brain, title: "Modelo Poisson", desc: "Calcula probabilidades de golos a partir dos ritmos históricos de marcação." },
  { icon: Dices, title: "Simulação Monte Carlo", desc: "Corre centenas de simulações do jogo para estimativas de probabilidade robustas." },
  { icon: Scale, title: "Lógica de Valor", desc: "Compara as probabilidades do modelo com as odds para identificar desfechos mal cotados." },
];

const whyDifferent = [
  "Não são previsões — são probabilidades",
  "Não é adivinhar — são decisões com dados",
  "Comparação real com o mercado",
  "Construído para edge a longo prazo",
];

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 1500;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start * 10) / 10);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, target]);

  return <span ref={ref} className="font-mono-data">{count.toFixed(target % 1 !== 0 ? 1 : 0)}{suffix}</span>;
}

export default function Landing() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const glowX = useTransform(mouseX, [0, 1400], [-120, 120]);
  const glowY = useTransform(mouseY, [0, 900], [-80, 80]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground antialiased">
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_15%_12%,rgba(34,211,238,0.14),transparent_20%),radial-gradient(circle_at_82%_10%,rgba(34,197,94,0.12),transparent_18%),radial-gradient(circle_at_18%_42%,rgba(34,211,238,0.08),transparent_24%),radial-gradient(circle_at_76%_58%,rgba(34,197,94,0.07),transparent_22%),radial-gradient(circle_at_50%_82%,rgba(34,211,238,0.07),transparent_24%),linear-gradient(180deg,rgba(6,11,20,1)_0%,rgba(7,17,31,1)_30%,rgba(6,13,24,1)_64%,rgba(5,12,21,1)_100%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:88px_88px] opacity-40" />
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/8 bg-background/66 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-primary/25 bg-[linear-gradient(135deg,rgba(34,211,238,0.22),rgba(34,197,94,0.18))] shadow-[0_10px_30px_rgba(34,211,238,0.18)]">
              <div className="absolute inset-[1px] rounded-[11px] bg-[linear-gradient(180deg,rgba(7,17,31,0.92),rgba(12,27,40,0.82))]" />
              <BarChart3 className="relative w-4 h-4 text-cyan-100" strokeWidth={1.7} />
            </div>
            <div>
              <span className="block bg-[linear-gradient(90deg,#ffffff_0%,#9fe8ff_40%,#8ef0c2_100%)] bg-clip-text text-lg font-black tracking-[-0.04em] text-transparent">ScoreLab</span>
              <span className="-mt-1 hidden text-[9px] font-semibold uppercase tracking-[0.22em] text-white/34 sm:block">Betting Intelligence OS</span>
            </div>
          </Link>
          <div className="hidden items-center gap-2 rounded-full border border-white/8 bg-white/[0.035] p-1 text-sm text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] md:flex">
            <a href="#features" className="rounded-full px-4 py-2 transition-colors hover:bg-white/[0.06] hover:text-foreground">Funcionalidades</a>
            <a href="#how-it-works" className="rounded-full px-4 py-2 transition-colors hover:bg-white/[0.06] hover:text-foreground">Como Funciona</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:block"><Button variant="ghost" size="sm">Entrar</Button></Link>
            <Link to="/signup"><Button variant="hero" size="sm">Começar Grátis</Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-20 pt-28 sm:px-6 md:pb-24 md:pt-32" onMouseMove={handleMouseMove}>
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_32%,rgba(34,211,238,0.10),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(34,197,94,0.09),transparent_22%),radial-gradient(circle_at_48%_78%,rgba(34,211,238,0.07),transparent_28%),linear-gradient(180deg,rgba(7,17,31,0.90)_0%,rgba(8,22,38,0.94)_45%,rgba(6,16,28,0.96)_100%)]" />
        <motion.div
          className="absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
          style={{ x: glowX, y: glowY }}
        />
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute w-[600px] h-[600px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsla(142,71%,45%,0.04) 0%, transparent 70%)",
              top: "10%",
              left: "60%",
            }}
            animate={{
              x: [0, 30, -20, 0],
              y: [0, -20, 30, 0],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsla(222,47%,20%,0.15) 0%, transparent 70%)",
              top: "50%",
              left: "20%",
            }}
            animate={{
              x: [0, -30, 20, 0],
              y: [0, 20, -30, 0],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl lg:grid lg:grid-cols-[1fr_0.84fr] lg:items-start lg:gap-10">
          <motion.div
            className="max-w-3xl relative z-10 lg:-mt-6"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.1 } },
            }}
          >
            <motion.div variants={fadeIn} custom={0} className="mb-6">
              <Badge variant="outline" className="gap-2 border-primary/18 bg-[linear-gradient(90deg,rgba(34,211,238,0.09),rgba(34,197,94,0.08))] py-1.5 text-muted-foreground shadow-[0_0_24px_rgba(34,211,238,0.08)]">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Análise Estatística de Futebol — Grátis
              </Badge>
            </motion.div>
            <motion.h1 variants={fadeIn} custom={1} className="max-w-4xl text-4xl sm:text-5xl font-black leading-[0.98] sm:leading-[0.96] tracking-[-0.05em] sm:tracking-[-0.065em] text-foreground md:text-7xl xl:text-[5.65rem]">
              Analisa o{" "}
              <span className="bg-[linear-gradient(90deg,hsl(var(--primary))_0%,hsl(var(--primary-glow))_45%,#8be9ff_100%)] bg-clip-text text-transparent">
                Futebol
              </span>{" "}
              como um{" "}
              <span className="text-gradient-primary">Profissional</span>
            </motion.h1>
            <motion.p variants={fadeIn} custom={2} className="mt-5 sm:mt-6 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8 text-muted-foreground md:text-xl">
              Um espaço de análise de futebol para probabilidades, deteção de valor, disciplina de banca e calibração de modelos. Gratuito para todos.
            </motion.p>
            <motion.div variants={fadeIn} custom={3} className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link to="/analysis"><Button variant="hero" size="xl">Iniciar Análise <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
              <Link to="/radar"><Button variant="hero-outline" size="xl"><Radar className="w-4 h-4 mr-1" /> Explorar o Value Radar</Button></Link>
            </motion.div>

            {/* Animated Stats */}
            <motion.div variants={fadeIn} custom={4} className="mt-8 sm:mt-10 grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
              {[
                { value: 15, suffix: "", label: "Mercados por Jogo" },
                { value: 400, suffix: "", label: "Simulações por Análise" },
                { value: 30, suffix: "+", label: "Ligas Calibradas" },
              ].map(s => (
                <Card key={s.label} className="rounded-2xl border-white/8 bg-[linear-gradient(180deg,rgba(34,211,238,0.055),rgba(255,255,255,0.025))] text-center shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
                  <CardContent className="p-2.5 sm:p-4">
                    <p className="text-lg sm:text-2xl font-bold text-foreground"><AnimatedCounter target={s.value} suffix={s.suffix} /></p>
                    <p className="mt-0.5 text-[10px] leading-tight sm:text-xs text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          </motion.div>

          {/* Hero Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            className="relative mt-4 hidden lg:block lg:mt-[3.5rem] lg:max-w-[520px] lg:justify-self-end"
          >
            <div className="relative">
              <div className="absolute -inset-[1px] rounded-[30px] bg-[linear-gradient(135deg,rgba(34,211,238,0.35),rgba(34,197,94,0.2),rgba(34,211,238,0.1))] opacity-80 blur-[2px]" />
              <div className="absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.14),transparent_34%)]" />
              <div className="absolute left-5 top-5 h-8 w-8 rounded-tl-[18px] border-l border-t border-cyan-300/25" />
              <div className="absolute bottom-5 right-5 h-8 w-8 rounded-br-[18px] border-b border-r border-emerald-300/25" />
              <div className="rounded-[28px] border border-primary/15 bg-[linear-gradient(180deg,rgba(8,18,30,0.94),rgba(9,16,27,0.96))] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.36)] backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Dashboard</p>
                  <h3 className="mt-1.5 text-lg font-semibold text-foreground">Visão de valor ao vivo</h3>
                </div>
                <div className="rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(34,197,94,0.12))] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary ring-1 ring-primary/20">
                  Live
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2.5">
                {[
                  { label: "Confiança", value: "8.6", sub: "Alta" },
                  { label: "Edge", value: "+11.8%", sub: "Premium" },
                  { label: "Risco", value: "Baixo", sub: "Controlado" },
                  { label: "Stake", value: "2.4%", sub: "Kelly" },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + i * 0.06 }}
                    className="rounded-xl bg-white/[0.03] ring-1 ring-white/5 p-3"
                  >
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-lg font-bold font-mono-data text-foreground">{item.value}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{item.sub}</p>
                  </motion.div>
                ))}
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/5 p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Tendência</p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-primary">7D</p>
                  </div>
                  <div className="mt-4 flex h-16 items-end gap-1.5">
                    {[34, 56, 48, 72, 68, 84, 79, 92].map((height, i) => (
                      <motion.div
                        key={`${height}-${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: `${height}%`, opacity: 1 }}
                        transition={{ delay: 1 + i * 0.05, duration: 0.4 }}
                        className={`flex-1 rounded-t-xl ${i > 5 ? "bg-[linear-gradient(180deg,#34d399,#22d3ee)]" : "bg-white/15"}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/5 p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Melhor Sinal</p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-primary">Hoje</p>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {[
                      { match: "Arsenal vs Chelsea", market: "Mais de 2.5", tone: "bg-primary/10 text-primary" },
                      { match: "Liverpool vs Man City", market: "Ambas Marcam", tone: "bg-emerald-500/10 text-emerald-300" },
                    ].map((row) => (
                      <div key={row.match} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5">
                        <div>
                          <p className="text-sm font-medium leading-tight text-foreground">{row.match}</p>
                          <p className="text-[11px] text-muted-foreground">{row.market}</p>
                        </div>
                        <div className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${row.tone}`}>
                          Sinal
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Value Radar Preview */}
      <section className="relative border-t border-white/5 px-4 py-14 sm:px-6 sm:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_32%,rgba(34,211,238,0.10),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(34,197,94,0.09),transparent_22%),radial-gradient(circle_at_48%_78%,rgba(34,211,238,0.07),transparent_28%),linear-gradient(180deg,rgba(7,17,31,0.90)_0%,rgba(8,22,38,0.94)_45%,rgba(6,16,28,0.96)_100%)]" />
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 rounded-full ring-1 ring-primary/20 bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(34,197,94,0.12))] px-4 py-1.5 text-xs text-primary mb-4 shadow-[0_0_24px_rgba(34,211,238,0.10)]">
              <Radar className="w-3 h-3" /> Scanner ao Vivo
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
              O{" "}
              <span className="bg-[linear-gradient(90deg,hsl(var(--primary))_0%,hsl(var(--primary-glow))_55%,#8be9ff_100%)] bg-clip-text text-transparent">
                Value Radar
              </span>{" "}
              de Hoje
            </h2>
            <p className="mt-4 text-muted-foreground max-w-lg mx-auto">A leitura contínua do mercado encontra as melhores oportunidades por ti.</p>
          </div>

          <div className="mb-6 hidden gap-4 md:grid md:grid-cols-3">
            {[
              { label: "Oportunidades visíveis", value: "6 picks ao vivo", hint: "Ordenadas por edge e confiança" },
              { label: "Melhor confiança", value: "9 / 10", hint: "O cartão mais forte do quadro" },
              { label: "Maior diferença de valor", value: "+11.8%", hint: "Diferença entre modelo e mercado" },
            ].map((item) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-[24px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(13,30,47,0.84)_0%,rgba(8,21,35,0.92)_100%)] px-5 py-4 shadow-[0_18px_48px_-20px_rgba(34,211,238,0.20)] backdrop-blur-xl"
              >
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{item.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
              </motion.div>
            ))}
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-2 mb-4 justify-end">
            <span className="text-xs text-muted-foreground mr-1">Ordenar:</span>
            <button
              onClick={() => {/* static preview, no-op */}}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary ring-1 ring-primary/20"
            >
              Edge %
            </button>
            <button
              onClick={() => {/* static preview, no-op */}}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-white/5 text-muted-foreground ring-1 ring-white/10 hover:bg-white/10 transition-colors"
            >
              Confiança
            </button>
          </div>

          {/* Scanner table */}
          <div className="overflow-hidden rounded-[32px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(10,25,41,0.92)_0%,rgba(8,19,33,0.97)_100%)] shadow-[0_28px_80px_-26px_rgba(34,211,238,0.20)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/6 px-5 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Quadro de oportunidades</p>
                <p className="mt-1 text-sm font-medium text-foreground">Edges de mercado de hoje, ordenados ao vivo</p>
              </div>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                Atualizado ao vivo
              </div>
            </div>
            {/* Header */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_0.7fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-2 px-5 py-3 border-b border-white/5">
              {["Jogo", "Mercado", "Odd", "Modelo %", "Edge", "Confiança", "Decisão"].map(h => (
                <span key={h} className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{h}</span>
              ))}
            </div>

            {/* Rows */}
            {radarPreview.map((item, i) => (
              <motion.div
                key={`${item.home}-${item.away}`}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className={`
                  ${i > 2 ? "hidden md:grid" : "grid"} grid-cols-1 md:grid-cols-[2fr_1fr_0.7fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-2 md:gap-2 items-center px-4 md:px-5 py-4
                  border-b border-white/5 last:border-b-0
                  hover:bg-white/[0.04] transition-all duration-300 cursor-pointer group
                  ${item.best ? "bg-[linear-gradient(90deg,rgba(34,211,238,0.08),rgba(34,197,94,0.06))]" : ""}
                `}
              >
                {/* Match Info */}
                <div>
                  {item.best && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[linear-gradient(90deg,rgba(34,211,238,0.18),rgba(34,197,94,0.16))] text-primary ring-1 ring-primary/30 mb-1.5 shadow-[0_0_16px_rgba(34,211,238,0.12)]">
                      🔥 Melhor Valor de Hoje
                    </span>
                  )}
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {item.home} vs {item.away}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">{item.league}</span>
                    {item.tag && (
                      <span className="text-[10px] text-primary/70 italic">· {item.tag}</span>
                    )}
                  </div>
                </div>

                {/* Mobile compact summary */}
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 md:hidden">
                  <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] text-muted-foreground ring-1 ring-white/10">{item.market}</span>
                  <span className="font-mono-data text-[13px] font-medium text-foreground">@{item.odds.toFixed(2)}</span>
                  <span className={`font-mono-data text-[13px] font-bold ${item.edge > 0 ? "text-primary" : "text-destructive"}`}>
                    {item.edge > 0 ? "+" : ""}{item.edge.toFixed(1)}%
                  </span>
                  <span className={`ml-auto inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider
                    ${item.decision === "Apostar" ? "bg-primary/10 text-primary ring-1 ring-primary/20" : ""}
                    ${item.decision === "Cautela" ? "bg-warning/10 text-warning ring-1 ring-warning/20" : ""}
                    ${item.decision === "Não Apostar" ? "bg-destructive/10 text-destructive ring-1 ring-destructive/20" : ""}
                  `}>
                    {item.decision}
                  </span>
                </div>

                {/* Market */}
                <span className="hidden text-xs text-muted-foreground md:block md:text-sm">{item.market}</span>

                {/* Odds */}
                <span className="hidden font-mono-data text-sm font-medium text-foreground md:block">{item.odds.toFixed(2)}</span>

                {/* Model % */}
                <span className="hidden font-mono-data text-sm text-foreground md:block">{item.modelProb.toFixed(1)}%</span>

                {/* Edge */}
                <span className={`hidden font-mono-data text-sm font-bold md:block ${item.edge > 0 ? "text-primary" : "text-destructive"}`}>
                  {item.edge > 0 ? "+" : ""}{item.edge.toFixed(1)}%
                </span>

                {/* Confidence */}
                <div className="hidden items-center gap-2 md:flex">
                  <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden max-w-[60px]">
                    <motion.div
                      className={`h-full rounded-full ${item.conf >= 7 ? "bg-primary" : item.conf >= 4 ? "bg-warning" : "bg-destructive"}`}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${item.conf * 10}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.2 + i * 0.06 }}
                    />
                  </div>
                  <span className="font-mono-data text-xs text-muted-foreground">{item.conf}</span>
                </div>

                {/* Decision */}
                <span className={`hidden md:inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider w-fit
                  ${item.decision === "Apostar" ? "bg-primary/10 text-primary ring-1 ring-primary/20" : ""}
                  ${item.decision === "Cautela" ? "bg-warning/10 text-warning ring-1 ring-warning/20" : ""}
                  ${item.decision === "Não Apostar" ? "bg-destructive/10 text-destructive ring-1 ring-destructive/20" : ""}
                `}>
                  {item.decision}
                </span>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link to="/radar">
              <Button variant="hero-outline" size="lg">
                Ver Todas as Oportunidades <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative border-t border-white/5 px-4 py-14 sm:px-6 sm:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_32%,rgba(34,211,238,0.10),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(34,197,94,0.09),transparent_22%),radial-gradient(circle_at_48%_78%,rgba(34,211,238,0.07),transparent_28%),linear-gradient(180deg,rgba(7,17,31,0.90)_0%,rgba(8,22,38,0.94)_45%,rgba(6,16,28,0.96)_100%)]" />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-16">
            <div className="inline-flex items-center gap-2 rounded-full ring-1 ring-primary/20 bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(34,197,94,0.12))] px-4 py-1.5 text-xs text-primary mb-4 shadow-[0_0_24px_rgba(34,211,238,0.10)]">
              <Target className="h-3.5 w-3.5" />
              Funcionalidades
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
              Quantifica o{" "}
              <span className="bg-[linear-gradient(90deg,#ffffff_0%,hsl(var(--primary-glow))_55%,#8be9ff_100%)] bg-clip-text text-transparent">
                Relvado
              </span>
            </h2>
            <p className="mt-4 text-muted-foreground max-w-lg mx-auto">Todas as ferramentas para decidir com dados, numa só plataforma — sem pagar nada.</p>
          </div>
          <div className="mb-8 hidden gap-4 md:grid md:grid-cols-3">
            {[
              { label: "Camadas de análise", value: "Jogo + Mercado + Risco", hint: "Um fluxo único, dos dados à decisão" },
              { label: "Camada de decisão", value: "Confiança primeiro", hint: "Sinais estruturados e comparáveis" },
              { label: "Ciclo de registo", value: "Atento ao desempenho", hint: "Feito para aprender com resultados reais" },
            ].map((item) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-[24px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(13,30,47,0.84)_0%,rgba(8,21,35,0.92)_100%)] px-5 py-4 shadow-[0_18px_48px_-20px_rgba(34,211,238,0.20)] backdrop-blur-xl"
              >
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{item.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
              </motion.div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeIn}
                custom={i}
                whileHover={{ y: -6, scale: 1.02 }}
                className="group cursor-default rounded-[22px] sm:rounded-[28px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(10,25,41,0.92)_0%,rgba(8,19,33,0.97)_100%)] p-4 sm:p-6 shadow-[0_24px_72px_-24px_rgba(34,211,238,0.16)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_80px_-24px_rgba(34,211,238,0.24)] backdrop-blur-xl"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(34,197,94,0.16))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_-14px_rgba(34,211,238,0.30)] transition-colors group-hover:bg-primary/20">
                  <f.icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                </div>
                <div className="mb-3 h-px w-full bg-[linear-gradient(90deg,rgba(34,211,238,0.25),rgba(34,197,94,0.0))]" />
                <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1 sm:mb-2">{f.title}</h3>
                <p className="hidden text-sm text-muted-foreground leading-relaxed sm:block">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How ScoreLab Thinks */}
      <section className="relative border-t border-white/5 px-4 py-14 sm:px-6 sm:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_32%,rgba(34,211,238,0.10),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(34,197,94,0.09),transparent_22%),radial-gradient(circle_at_48%_78%,rgba(34,211,238,0.07),transparent_28%),linear-gradient(180deg,rgba(7,17,31,0.90)_0%,rgba(8,22,38,0.94)_45%,rgba(6,16,28,0.96)_100%)]" />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-16">
            <div className="inline-flex items-center gap-2 rounded-full ring-1 ring-primary/20 bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(34,197,94,0.12))] px-4 py-1.5 text-xs text-primary mb-4 shadow-[0_0_24px_rgba(34,211,238,0.10)]">
              <Brain className="h-3.5 w-3.5" />
              Inteligência
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
              Como o{" "}
              <span className="bg-[linear-gradient(90deg,hsl(var(--primary))_0%,hsl(var(--primary-glow))_55%,#8be9ff_100%)] bg-clip-text text-transparent">
                ScoreLab
              </span>{" "}
              Pensa
            </h2>
            <p className="mt-4 text-muted-foreground max-w-lg mx-auto">Três camadas de análise sustentam cada recomendação.</p>
          </div>
          <div className="mb-8 hidden gap-4 md:grid md:grid-cols-3">
            {[
              { label: "Camada probabilística", value: "Base Poisson", hint: "Converte ritmos de golo em probabilidades estruturadas." },
              { label: "Camada de simulação", value: "Testada em cenários", hint: "Ganha robustez ao explorar muitos caminhos possíveis do jogo." },
              { label: "Camada de decisão", value: "Sensível ao edge", hint: "Traduz a força do modelo num sinal utilizável." },
            ].map((item) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-[24px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(13,30,47,0.84)_0%,rgba(8,21,35,0.92)_100%)] px-5 py-4 shadow-[0_18px_48px_-20px_rgba(34,211,238,0.20)] backdrop-blur-xl"
              >
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{item.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
              </motion.div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {thinkingSteps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="rounded-[28px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(10,25,41,0.92)_0%,rgba(8,19,33,0.97)_100%)] p-5 sm:p-8 text-center relative overflow-hidden group backdrop-blur-xl hover:-translate-y-1 transition-all duration-300 shadow-[0_24px_72px_-24px_rgba(34,211,238,0.16)] hover:shadow-[0_28px_80px_-24px_rgba(34,211,238,0.24)]"
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsla(142,71%,45%,0.03)_0%,_transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(34,197,94,0.16))] flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/15 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_-14px_rgba(34,211,238,0.30)]">
                    <step.icon className="w-7 h-7 text-primary" strokeWidth={1.5} />
                  </div>
                  <div className="text-4xl font-bold text-white/[0.04] mb-2">{String(i + 1).padStart(2, "0")}</div>
                  <div className="mx-auto mb-3 h-px w-20 bg-[linear-gradient(90deg,rgba(34,211,238,0.25),rgba(34,197,94,0.0))]" />
                  <h3 className="text-lg font-semibold text-foreground mb-3">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why ScoreLab is Different */}
      <section className="relative border-t border-white/5 px-4 py-14 sm:px-6 sm:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_32%,rgba(34,211,238,0.10),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(34,197,94,0.09),transparent_22%),radial-gradient(circle_at_48%_78%,rgba(34,211,238,0.07),transparent_28%),linear-gradient(180deg,rgba(7,17,31,0.90)_0%,rgba(8,22,38,0.94)_45%,rgba(6,16,28,0.96)_100%)]" />
        <div className="relative max-w-5xl mx-auto">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 rounded-full ring-1 ring-primary/20 bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(34,197,94,0.12))] px-4 py-1.5 text-xs text-primary mb-4 shadow-[0_0_24px_rgba(34,211,238,0.10)]">
              <Crosshair className="h-3.5 w-3.5" />
              Filosofia
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">Porque é que o ScoreLab é Diferente</h2>
            <p className="mt-4 max-w-2xl mx-auto text-muted-foreground">
              Feito para quem quer estrutura e não ruído — um método que continua útil ao longo do tempo.
            </p>
          </div>
          <div className="mb-8 hidden gap-4 md:grid md:grid-cols-3">
            {[
              { label: "Mentalidade", value: "Probabilidade acima do ruído", hint: "Desenhado para apoiar o julgamento, não o impulso." },
              { label: "Método", value: "Análise atenta ao mercado", hint: "Cada recomendação vive em contexto, contra preço e risco." },
              { label: "Resultado", value: "Disciplina a longo prazo", hint: "Registo e gestão de banca fazem parte do mesmo ciclo." },
            ].map((item) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-[24px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(13,30,47,0.84)_0%,rgba(8,21,35,0.92)_100%)] px-5 py-4 shadow-[0_18px_48px_-20px_rgba(34,211,238,0.20)] backdrop-blur-xl"
              >
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{item.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
              </motion.div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="space-y-4">
                {whyDifferent.map((point, i) => (
                  <motion.div
                    key={point}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3 rounded-2xl border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(10,25,41,0.78)_0%,rgba(8,19,33,0.92)_100%)] px-4 py-3 shadow-[0_18px_48px_-20px_rgba(34,211,238,0.14)]"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(34,197,94,0.16))] flex items-center justify-center flex-shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_-14px_rgba(34,211,238,0.24)]">
                      <Crosshair className="w-4 h-4 text-primary" strokeWidth={1.5} />
                    </div>
                    <p className="text-foreground font-medium">{point}</p>
                  </motion.div>
                ))}
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="rounded-[28px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(10,25,41,0.92)_0%,rgba(8,19,33,0.97)_100%)] p-8 backdrop-blur-xl shadow-[0_24px_72px_-24px_rgba(34,211,238,0.16)]"
            >
              <div className="space-y-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Apostar por Intuição</p>
                  <div className="h-3 rounded-full bg-destructive/20 overflow-hidden">
                    <div className="h-full w-[35%] rounded-full bg-destructive/50" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Decisões inconsistentes, impossíveis de medir</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Método ScoreLab</p>
                  <div className="h-3 rounded-full bg-primary/20 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full gradient-primary"
                      initial={{ width: 0 }}
                      whileInView={{ width: "67%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.3 }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Probabilidades calibradas e decisões que podes medir</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="relative border-t border-white/5 px-4 py-14 sm:px-6 sm:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_32%,rgba(34,211,238,0.10),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(34,197,94,0.09),transparent_22%),radial-gradient(circle_at_48%_78%,rgba(34,211,238,0.07),transparent_28%),linear-gradient(180deg,rgba(7,17,31,0.90)_0%,rgba(8,22,38,0.94)_45%,rgba(6,16,28,0.96)_100%)]" />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-16">
            <div className="inline-flex items-center gap-2 rounded-full ring-1 ring-primary/20 bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(34,197,94,0.12))] px-4 py-1.5 text-xs text-primary mb-4 shadow-[0_0_24px_rgba(34,211,238,0.10)]">
              <ChevronRight className="h-3.5 w-3.5" />
              Processo
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">Como Funciona o ScoreLab</h2>
            <p className="mt-4 max-w-2xl mx-auto text-muted-foreground">
              Um fluxo limpo: dos dados do jogo à deteção de valor e à disciplina de stake, fácil de confiar.
            </p>
          </div>
          <div className="mb-8 hidden gap-4 md:grid md:grid-cols-3">
            {[
              { label: "Entrada", value: "Contexto do jogo primeiro", hint: "Começa com as estatísticas, odds e a competição certa." },
              { label: "Motor", value: "Modelo e depois mercado", hint: "O sistema compara a visão probabilística com os preços reais." },
              { label: "Saída", value: "Decisão com disciplina", hint: "Termina com stake dimensionada e recomendação rastreável." },
            ].map((item) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-[24px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(13,30,47,0.84)_0%,rgba(8,21,35,0.92)_100%)] px-5 py-4 shadow-[0_18px_48px_-20px_rgba(34,211,238,0.20)] backdrop-blur-xl"
              >
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{item.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
              </motion.div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeIn}
                custom={i}
                whileHover={{ y: -4, scale: 1.01 }}
                className="relative rounded-[28px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(10,25,41,0.92)_0%,rgba(8,19,33,0.97)_100%)] p-5 transition-all duration-300 backdrop-blur-xl shadow-[0_24px_72px_-24px_rgba(34,211,238,0.16)] hover:-translate-y-1 hover:shadow-[0_28px_80px_-24px_rgba(34,211,238,0.24)]"
              >
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(34,197,94,0.16))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_-14px_rgba(34,211,238,0.30)]">
                  <span className="text-sm font-bold font-mono-data text-primary">{step.num}</span>
                </div>
                <div className="mb-3 h-px w-full bg-[linear-gradient(90deg,rgba(34,211,238,0.25),rgba(34,197,94,0.0))]" />
                <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1 sm:mb-2">{step.title}</h3>
                <p className="hidden text-sm text-muted-foreground sm:block">{step.desc}</p>
                {i < steps.length - 1 && (
                  <ChevronRight className="hidden md:block absolute top-8 -right-3 w-5 h-5 text-white/10" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="relative border-t border-white/5 px-4 py-20 sm:px-6 md:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,var(--scorelab-accent-a-soft),transparent_28%),radial-gradient(circle_at_50%_80%,var(--scorelab-accent-b-soft),transparent_34%),linear-gradient(180deg,rgba(7,17,31,0.84),rgba(5,12,21,0.98))]" />
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[36px] border border-cyan-100/10 bg-[linear-gradient(135deg,rgba(13,30,47,0.92),rgba(8,19,33,0.98))] px-6 py-12 text-center shadow-[0_34px_96px_-40px_rgba(34,211,238,0.32)] backdrop-blur-xl md:px-12 md:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent,rgba(255,255,255,0.055),transparent)] opacity-70" />
          <Badge variant="outline" className="relative mb-5 border-primary/18 text-primary">Pronto para o pontapé de saída</Badge>
          <h2 className="relative text-3xl font-black tracking-[-0.045em] text-foreground md:text-5xl">
            Pronto para Encontrar o teu{" "}
            <span className="bg-[linear-gradient(90deg,hsl(var(--primary))_0%,hsl(var(--primary-glow))_55%,#8be9ff_100%)] bg-clip-text text-transparent">
              Edge?
            </span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-2xl text-muted-foreground">Análise probabilística de jogos, deteção de valor e disciplina de banca — com dados, não com palpites. Grátis para todos.</p>
          <div className="relative mt-8 flex justify-center gap-4">
            <Link to="/signup"><Button variant="hero" size="xl">Criar Conta Grátis <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 px-4 py-10 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.2fr_0.8fr_0.8fr] md:items-start">
          <div>
            <div className="flex items-center gap-2">
            <div className="relative flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-primary/25 bg-[linear-gradient(135deg,rgba(34,211,238,0.22),rgba(34,197,94,0.18))] shadow-[0_8px_22px_rgba(34,211,238,0.14)]">
              <div className="absolute inset-[1px] rounded-[7px] bg-[linear-gradient(180deg,rgba(7,17,31,0.92),rgba(12,27,40,0.82))]" />
              <BarChart3 className="relative w-3 h-3 text-cyan-100" strokeWidth={1.6} />
            </div>
            <span className="text-sm font-semibold bg-[linear-gradient(90deg,#ffffff_0%,#9fe8ff_40%,#8ef0c2_100%)] bg-clip-text text-transparent">ScoreLab</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Onde a estatística do futebol, a disciplina de mercado e a gestão de banca se tornam um só sistema.</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">Produto</p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <a href="#features" className="transition-colors hover:text-foreground">Funcionalidades</a>
              <a href="#how-it-works" className="transition-colors hover:text-foreground">Como Funciona</a>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">Começar</p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to="/analysis" className="transition-colors hover:text-foreground">Iniciar Análise</Link>
              <Link to="/dashboard" className="transition-colors hover:text-foreground">Abrir Dashboard</Link>
              <Link to="/signup" className="transition-colors hover:text-foreground">Criar Conta</Link>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-2 border-t border-white/8 pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 ScoreLab. Todos os direitos reservados.</p>
          <p>Análise estatística, não aconselhamento financeiro. Joga com responsabilidade. +18 · jogaresponsavelmente.pt</p>
        </div>
      </footer>
    </div>
  );
}
