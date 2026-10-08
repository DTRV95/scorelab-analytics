import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Check,
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
 * Poisson engines, Kelly calculators, saved analyses — while the app behind
 * the login had become something else: challenges climbed level by level, a
 * board of games with each competition's own rates beside them, and a record
 * of every bet.
 *
 * It is the same app now, in the same clothes, and it opens with the thing
 * the app is for: the probabilities of the games being played, readable
 * without an account. Asking somebody to sign up to see a number that is the
 * same for everybody is asking for trust before giving any.
 */

const ease = [0.22, 0.61, 0.36, 1] as const;

const rise = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const SHOW = { once: true, amount: 0.3 } as const;

/** What the app does, in the order somebody scrolling would ask it. */
const WHAT: {
  icon: typeof Trophy;
  tag: string;
  title: string;
  text: string;
  points: string[];
}[] = [
  {
    icon: Percent,
    tag: "Jogos",
    title: "A probabilidade de cada mercado, já calculada",
    text: "Os jogos das competições cobertas chegam sozinhos, com quinze mercados cada um: resultado, golos, ambas marcam e as combinações. Por baixo de cada jogo, os mercados em que ele foge à própria liga.",
    points: [
      "Sete dias, um dia de cada vez, agrupados por competição",
      "«Ambas Marcam 57% · a liga dá 49%» — a escala ao lado do número",
      "Nenhuma odd pelo meio: aqui é só o que costuma acontecer",
    ],
  },
  {
    icon: Trophy,
    tag: "Desafios",
    title: "Uma escada que diz quanto apostar",
    text: "Escolhes um desafio e ele faz as contas, nível a nível: quanto entra e a que odd. Ganhas, sobes um degrau; perdes, desces — e a conta refaz-se a partir da banca que tens mesmo, não da que estava no papel.",
    points: [
      "Dez modelos prontos, do mais fácil ao que quase nunca sai",
      "A dificuldade de cada um medida por simulação, não por opinião",
      "Terminar guarda tudo numa prateleira, com o que deu",
    ],
  },
  {
    icon: Globe,
    tag: "Ligas",
    title: "O que cada competição costuma dar",
    text: "A época inteira contada, mercado a mercado: quantas vezes a casa ganha, quantas vezes há mais de 2.5, quantas vezes marcam as duas — sempre com o número de jogos por trás da percentagem.",
    points: [
      "Golos por jogo, e a média em casa e fora",
      "Top 3 por forma, com o V-E-D à vista",
      "Onze competições, sem escrever nada",
    ],
  },
  {
    icon: BarChart3,
    tag: "Análises",
    title: "O teu registo, sem conversa",
    text: "Cada aposta fica contada por mercado, por faixa de odd e por número de jogos no boletim. Ao lado de cada taxa está o que o preço exigia para se pagar, que é a comparação que decide se o ano acaba acima ou abaixo.",
    points: [
      "Uma percentagem só aparece quando há apostas que cheguem",
      "Verde é bom, vermelho é mau, cinzento é cedo demais",
      "As apostas de fora dos desafios contam na mesma",
    ],
  },
  {
    icon: Swords,
    tag: "A dois",
    title: "O mesmo desafio, dois jogadores",
    text: "Cada um com a sua banca, os dois a ver as apostas um do outro. O Início conta o que aconteceu desde a última vez que lá foste, e diz quem está à frente e por quanto.",
    points: [
      "Convites por email, e cada um sai quando quiser",
      "Frente a frente: lucro, eficácia e melhor série",
      "Ou sozinho, que funciona exactamente na mesma",
    ],
  },
];

const STEPS = [
  {
    num: "01",
    title: "Vê os jogos",
    text: "A lista aqui em cima é a mesma de lá dentro. Sem conta, sem nada.",
  },
  {
    num: "02",
    title: "Escolhe um desafio",
    text: "Ele diz quanto apostar e a que odd em cada nível, a partir da tua banca.",
  },
  {
    num: "03",
    title: "Regista e deixa andar",
    text: "Os resultados dos jogos cobertos fecham-se sozinhos. A escada anda.",
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

/**
 * One screen of the app, in the frame it was taken on.
 *
 * Only the top of the screen is shown, fading into the frame: a phone at full
 * height would set the height of everything beside it.
 */
function Phone({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative overflow-hidden rounded-[1.8rem] bg-[hsl(var(--sl-nav))] p-1.5 shadow-[0_30px_60px_-24px_hsla(222,47%,11%,0.45),0_12px_24px_-12px_hsla(222,47%,11%,0.25)]">
      <div className="relative max-h-[15rem] overflow-hidden rounded-[1.4rem]">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          width={390}
          height={844}
          className="block w-full"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[hsl(var(--sl-nav))] to-transparent"
        />
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground antialiased">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_80%_-10%,hsla(14,100%,50%,0.16),transparent_60%),radial-gradient(45rem_30rem_at_0%_20%,hsla(152,72%,30%,0.10),transparent_55%),linear-gradient(180deg,hsl(var(--sl-surface))_0%,hsl(var(--background))_45%)]" />

      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Mark />
            <span className="text-[15px] font-black tracking-[-0.02em] text-foreground">
              ScoreLab
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {[
              ["#jogos", "Jogos de hoje"],
              ["#o-que-faz", "O que faz"],
              ["#ligas", "Ligas"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>

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
        {/* The probabilities are the shop window, so they are in it. */}
        <section id="jogos" className="px-4 pb-10 pt-10 sm:px-6 md:pb-16 md:pt-14">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="mx-auto grid max-w-6xl items-center gap-9 lg:grid-cols-2 lg:gap-12"
          >
            <div className="max-w-xl">
              <motion.span
                variants={rise}
                className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-[11px] font-semibold text-muted-foreground shadow-[var(--shadow-card)] ring-1 ring-border"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--sl-green))]" />
                Probabilidades abertas a toda a gente
              </motion.span>

              <motion.h1
                variants={rise}
                className="mt-5 text-[2.5rem] font-black leading-[1.03] tracking-[-0.03em] text-foreground sm:text-[3.4rem]"
              >
                O que é provável{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "var(--sl-gradient)" }}
                >
                  acontecer
                </span>{" "}
                nos jogos de hoje.
              </motion.h1>

              <motion.p
                variants={rise}
                className="mt-5 text-[15px] leading-7 text-muted-foreground"
              >
                Quinze mercados por jogo, calculados a partir da época inteira
                de cada competição. É a mesma lista que a aplicação usa, e está
                aqui de graça, sem conta nenhuma.
              </motion.p>

              <motion.div variants={rise} className="mt-7 flex flex-wrap gap-2.5">
                <Link
                  to="/signup"
                  className="sl-btn-primary inline-flex h-12 items-center gap-2 px-6 text-sm"
                >
                  Criar conta
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#o-que-faz"
                  className="inline-flex h-12 items-center rounded-2xl bg-card px-6 text-sm font-semibold text-foreground shadow-[var(--shadow-card)] ring-1 ring-border transition hover:bg-muted"
                >
                  Ver o que faz
                </a>
              </motion.div>
            </div>

            <motion.div variants={rise}>
              <PublicBoard />
            </motion.div>
          </motion.div>
        </section>

        <section id="o-que-faz" className="px-4 py-8 sm:px-6 md:py-14">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={SHOW}
            variants={stagger}
            className="mx-auto max-w-6xl"
          >
            <motion.p
              variants={rise}
              className="sl-meta text-[11px] uppercase tracking-[0.18em]"
            >
              O que faz
            </motion.p>
            <motion.h2
              variants={rise}
              className="mt-2 max-w-2xl text-3xl font-black tracking-[-0.025em] text-foreground sm:text-4xl"
            >
              Das probabilidades à aposta, e da aposta ao registo.
            </motion.h2>
            <motion.p
              variants={rise}
              className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground"
            >
              Com conta, isto passa a ser o sítio onde as apostas ficam a fazer
              sentido: desafios que dizem quanto apostar nível a nível, cada
              mercado comparado com o que a liga costuma dar, e um registo que
              no fim diz se valeu a pena.
            </motion.p>

            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {WHAT.map((block) => (
                <motion.article
                  key={block.tag}
                  variants={rise}
                  className="sl-card sl-card-interactive flex flex-col px-5 py-5 md:px-6 md:py-6"
                >
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
                    <block.icon className="h-3 w-3" />
                    {block.tag}
                  </span>
                  <h3 className="mt-3 text-[19px] font-black leading-tight tracking-[-0.02em] text-foreground">
                    {block.title}
                  </h3>
                  <p className="mt-2.5 text-[13.5px] leading-7 text-muted-foreground">
                    {block.text}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {block.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-2.5 text-[12.5px] leading-6 text-foreground"
                      >
                        <span className="mt-1 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-[hsl(var(--sl-green))]/12 text-[hsl(var(--sl-green))]">
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </motion.article>
              ))}

              {/* The odd one out of the grid: one screen, because at some point
                  somebody wants to see the thing rather than read about it. */}
              <motion.div
                variants={rise}
                className="sl-card flex items-center gap-4 overflow-hidden px-5 py-6 md:px-6"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-[19px] font-black leading-tight tracking-[-0.02em] text-foreground">
                    É isto, no telemóvel
                  </h3>
                  <p className="mt-2.5 text-[13.5px] leading-7 text-muted-foreground">
                    Feito para ser usado de pé, com uma mão, a dois minutos de
                    o jogo começar.
                  </p>
                  <Link
                    to="/signup"
                    className="sl-btn-primary mt-4 inline-flex h-10 items-center gap-1.5 px-4 text-[13px]"
                  >
                    Criar conta
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="relative w-[42%] max-w-[9.5rem] flex-none sm:max-w-[10.5rem]">
                  <div
                    aria-hidden
                    className="absolute -inset-8 -z-10 rounded-full bg-[radial-gradient(50%_40%_at_50%_35%,hsla(14,100%,50%,0.28),transparent_70%)]"
                  />
                  <Phone
                    src="/prints/app-desafio.jpg"
                    alt="A página de um desafio, com o nível a que vai e o que apostar a seguir"
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>
        </section>

        <section className="px-4 py-8 sm:px-6 md:py-12">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={SHOW}
            variants={stagger}
            className="mx-auto max-w-6xl"
          >
            <motion.h2
              variants={rise}
              className="max-w-2xl text-3xl font-black tracking-[-0.025em] text-foreground sm:text-4xl"
            >
              Três passos, e depois é só futebol.
            </motion.h2>

            <div className="mt-7 grid gap-3 md:grid-cols-3">
              {STEPS.map((step) => (
                <motion.div
                  key={step.num}
                  variants={rise}
                  className="sl-card sl-card-interactive px-5 py-5"
                >
                  <span
                    className="sl-figure text-[13px] text-transparent"
                    style={{
                      backgroundImage: "var(--sl-gradient)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                    }}
                  >
                    {step.num}
                  </span>
                  <h3 className="mt-2 text-[15px] font-bold text-foreground">
                    {step.title}
                  </h3>
                  <p className="sl-meta mt-1.5 text-[12.5px] leading-6">
                    {step.text}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        <section id="ligas" className="px-4 py-8 sm:px-6 md:py-12">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={SHOW}
            variants={stagger}
            className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[hsl(var(--sl-nav))] px-6 py-9 text-white sm:px-10"
          >
            <motion.h2
              variants={rise}
              className="text-2xl font-black tracking-[-0.025em] sm:text-3xl"
            >
              As competições que entram sozinhas
            </motion.h2>
            <motion.p
              variants={rise}
              className="mt-2 max-w-xl text-[13.5px] leading-7 text-white/60"
            >
              Jogos, previsões e resultados vêm da fonte de dados sem ninguém
              escrever nada. O que ela não cobre entra à mão, e a aplicação diz
              quando é o caso.
            </motion.p>
            <motion.div variants={rise} className="mt-6 flex flex-wrap gap-2">
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

        <section className="px-4 py-12 sm:px-6 md:py-20">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={SHOW}
            variants={stagger}
            className="mx-auto max-w-3xl text-center"
          >
            <motion.h2
              variants={rise}
              className="text-3xl font-black tracking-[-0.03em] text-foreground sm:text-5xl"
            >
              Começa com dez euros e um desafio.
            </motion.h2>
            <motion.p
              variants={rise}
              className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-muted-foreground"
            >
              Conta gratuita. Sem cartão, sem casa de apostas ligada: as
              apostas são tuas, isto é o sítio onde elas ficam a fazer sentido.
            </motion.p>
            <motion.div
              variants={rise}
              className="mt-7 flex flex-wrap justify-center gap-2.5"
            >
              <Link
                to="/signup"
                className="sl-btn-primary inline-flex h-12 items-center gap-2 px-7 text-sm"
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
      </main>

      <footer className="border-t border-border px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
        <p className="sl-meta mx-auto mt-6 max-w-6xl text-[11px] leading-5">
          Aposta com o que podes perder. Isto é uma ferramenta de registo e
          análise: não faz apostas, não as coloca por ti e não promete lucro
          nenhum.
        </p>
      </footer>
    </div>
  );
}
