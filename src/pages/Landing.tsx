import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Globe,
  Percent,
  Swords,
  Ticket,
  Trophy,
} from "lucide-react";
import { PublicBoard } from "@/components/PublicBoard";
import { COVERED_LEAGUES } from "@/lib/boardLeagues";

/**
 * The page everybody meets before signing in.
 *
 * It used to be a dark page advertising a product that no longer exists —
 * Poisson engines, Kelly calculators, saved analyses — and then, briefly, a
 * page that explained everything the app does at once, which is a different
 * way of saying nothing.
 *
 * What is left: the day's games with their probabilities, readable without an
 * account, and four things the app does, a sentence or two each. Asking
 * somebody to sign up to see a number that is the same for everybody is
 * asking for trust before giving any.
 */

const ease = [0.22, 0.61, 0.36, 1] as const;

const rise = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const SHOW = { once: true, amount: 0.3 } as const;

/** Four things, a sentence or two each. Anything more belongs inside. */
const FEATURES: {
  icon: typeof Trophy;
  title: string;
  text: string;
}[] = [
  {
    icon: Percent,
    title: "Probabilidades",
    text: "Quinze mercados por jogo — resultado, golos, ambas marcam e as combinações — calculados a partir da época inteira de cada competição.",
  },
  {
    icon: Trophy,
    title: "Desafios por níveis",
    text: "Uma escada que diz quanto apostar e a que odd. Ganhas, sobes um degrau; perdes, desces, e a conta refaz-se a partir da banca que tens mesmo.",
  },
  {
    icon: Globe,
    title: "O que a liga dá",
    text: "Cada mercado ao lado da taxa da própria competição esta época, para se ver quando um jogo foge ao normal da liga.",
  },
  {
    icon: BarChart3,
    title: "O teu registo",
    text: "Cada aposta contada por mercado e por faixa de odd, com o que o preço exigia para se pagar ao lado da tua taxa.",
  },
];

function Mark() {
  return (
    <span
      className="flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-black text-white"
      style={{ background: "var(--sl-gradient)" }}
    >
      SL
    </span>
  );
}

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground antialiased">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_80%_-10%,hsla(14,100%,50%,0.16),transparent_60%),radial-gradient(45rem_30rem_at_0%_20%,hsla(152,72%,30%,0.10),transparent_55%),linear-gradient(180deg,hsl(var(--sl-surface))_0%,hsl(var(--background))_45%)]" />

      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Mark />
            <span className="text-[15px] font-black tracking-[-0.02em] text-foreground">
              ScoreLab
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-lg px-3 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Entrar
            </Link>
            <Link
              to="/signup"
              className="sl-btn-primary inline-flex h-9 items-center gap-1.5 px-4 text-[13px]"
            >
              Criar conta
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="px-4 pb-8 pt-12 text-center sm:px-6 md:pb-10 md:pt-16">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="mx-auto max-w-2xl"
          >
            <motion.h1
              variants={rise}
              className="text-[2.5rem] font-black leading-[1.03] tracking-[-0.03em] text-foreground sm:text-[3.4rem]"
            >
              As probabilidades dos jogos{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "var(--sl-gradient)" }}
              >
                de hoje
              </span>
              .
            </motion.h1>

            <motion.p
              variants={rise}
              className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-muted-foreground"
            >
              Sem conta e sem custo. Com conta, viram desafios de banca com
              níveis, comparações com o que cada liga dá, e o registo de tudo o
              que apostaste.
            </motion.p>

            <motion.div
              variants={rise}
              className="mt-6 flex flex-wrap justify-center gap-2.5"
            >
              <Link
                to="/signup"
                className="sl-btn-primary inline-flex h-12 items-center gap-2 px-6 text-sm"
              >
                Criar conta
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex h-12 items-center rounded-2xl bg-card px-6 text-sm font-semibold text-foreground shadow-[var(--shadow-card)] ring-1 ring-border transition hover:bg-muted"
              >
                Entrar
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* The games are the page. Everything else is underneath them. */}
        <section id="jogos" className="px-4 pb-10 sm:px-6 md:pb-14">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={rise}
            className="mx-auto max-w-3xl"
          >
            <PublicBoard />
          </motion.div>
        </section>

        <section id="o-que-faz" className="px-4 py-6 sm:px-6 md:py-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={SHOW}
            variants={stagger}
            className="mx-auto max-w-5xl"
          >
            <motion.h2
              variants={rise}
              className="text-center text-2xl font-black tracking-[-0.025em] text-foreground sm:text-3xl"
            >
              E, com conta, o resto.
            </motion.h2>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <motion.article
                  key={feature.title}
                  variants={rise}
                  className="sl-card sl-card-interactive px-5 py-5"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <feature.icon className="h-4 w-4" />
                  </span>
                  <h3 className="mt-3 text-[17px] font-black tracking-[-0.015em] text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-[13.5px] leading-7 text-muted-foreground">
                    {feature.text}
                  </p>
                </motion.article>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="px-4 py-6 sm:px-6 md:py-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={SHOW}
            variants={stagger}
            className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-[hsl(var(--sl-nav))] px-6 py-8 text-white sm:px-9"
          >
            <motion.h2
              variants={rise}
              className="text-xl font-black tracking-[-0.02em] sm:text-2xl"
            >
              Onze competições, sem escrever nada
            </motion.h2>
            <motion.div variants={rise} className="mt-5 flex flex-wrap gap-2">
              {COVERED_LEAGUES.map((league) => (
                <span
                  key={league}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/85"
                >
                  {league}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </section>

        <section className="px-4 py-12 sm:px-6 md:py-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={SHOW}
            variants={stagger}
            className="mx-auto max-w-2xl text-center"
          >
            <motion.h2
              variants={rise}
              className="text-3xl font-black tracking-[-0.03em] text-foreground sm:text-4xl"
            >
              Começa com dez euros e um desafio.
            </motion.h2>
            <motion.div
              variants={rise}
              className="mt-6 flex flex-wrap justify-center gap-2.5"
            >
              <Link
                to="/signup"
                className="sl-btn-primary inline-flex h-12 items-center gap-2 px-7 text-sm"
              >
                Criar conta
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <Mark />
            <div>
              <p className="text-[13px] font-bold text-foreground">ScoreLab</p>
              <p className="sl-meta text-[11px]">
                Probabilidades, desafios de banca e registo de apostas.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {[
              [<Percent key="p" className="h-3 w-3" />, "Jogos"],
              [<Trophy key="t" className="h-3 w-3" />, "Desafios"],
              [<Ticket key="a" className="h-3 w-3" />, "Apostas"],
              [<Swords key="d" className="h-3 w-3" />, "A dois"],
            ].map(([icon, label]) => (
              <span
                key={String(label)}
                className="sl-meta flex items-center gap-1.5 text-[11px]"
              >
                {icon}
                {label}
              </span>
            ))}
          </div>
        </div>
        <p className="sl-meta mx-auto mt-6 max-w-5xl text-[11px] leading-5">
          Aposta com o que podes perder. Isto é uma ferramenta de registo e
          análise: não faz apostas, não as coloca por ti e não promete lucro
          nenhum.
        </p>
      </footer>
    </div>
  );
}
