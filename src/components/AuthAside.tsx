import { Link } from "react-router-dom";
import { Check } from "lucide-react";

/**
 * The half of the sign-in pages that is not the form.
 *
 * It used to advertise a product that no longer exists — Dixon-Coles, 30
 * calibrated leagues, ten thousand simulations per analysis — in a dark
 * palette the app behind the login had stopped using. Same app, same clothes,
 * and only things that are true.
 */
export function AuthAside({
  title,
  lead,
  points,
}: {
  title: string;
  lead: string;
  points: string[];
}) {
  return (
    <div className="relative hidden overflow-hidden bg-[hsl(var(--sl-surface))] lg:flex lg:w-1/2 lg:items-center lg:justify-center lg:p-12">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(45rem_30rem_at_20%_0%,hsla(14,100%,50%,0.16),transparent_60%),radial-gradient(35rem_25rem_at_90%_80%,hsla(152,72%,30%,0.10),transparent_60%)]"
      />

      <div className="relative w-full max-w-md">
        <Link to="/" className="flex items-center gap-2.5">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[14px] font-black text-white"
            style={{ background: "var(--sl-gradient)" }}
          >
            SL
          </span>
          <span className="text-[17px] font-black tracking-[-0.02em] text-foreground">
            ScoreLab
          </span>
        </Link>

        <h2 className="mt-8 text-3xl font-black leading-[1.1] tracking-[-0.025em] text-foreground">
          {title}
        </h2>
        <p className="mt-3 text-[14px] leading-7 text-muted-foreground">{lead}</p>

        <ul className="mt-7 space-y-2.5">
          {points.map((point) => (
            <li
              key={point}
              className="flex items-start gap-2.5 text-[13px] leading-6 text-foreground"
            >
              <span className="mt-1 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-[hsl(var(--sl-green))]/12 text-[hsl(var(--sl-green))]">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              {point}
            </li>
          ))}
        </ul>

        <div className="mt-10 overflow-hidden rounded-[1.6rem] bg-[hsl(var(--sl-nav))] p-1.5 shadow-[0_30px_60px_-24px_hsla(222,47%,11%,0.45)]">
          <div className="relative max-h-[17rem] overflow-hidden rounded-[1.3rem]">
            <img
              src="/prints/app-inicio.jpg"
              alt="O início da aplicação, com os desafios a decorrer"
              loading="lazy"
              decoding="async"
              width={390}
              height={844}
              className="block w-full"
            />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[hsl(var(--sl-nav))] to-transparent"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
