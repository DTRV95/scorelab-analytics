import type { ReactNode } from "react";

/**
 * Shared building blocks for the analysis forms (Match Analysis, Probability).
 * Kept tiny and presentation-only so both pages stay visually identical.
 */
export function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-border p-5">
      <div className="relative z-10 mb-5 flex items-center justify-between gap-3 border-b border-border pb-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </h3>
        <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_18px_var(--scorelab-accent-b)]" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function FormField({
  label,
  value,
  onChange,
  type = "text",
  description,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  description?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        step={type === "number" ? "any" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="scorelab-premium-input h-10 w-full rounded-xl border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
      {description ? (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  description,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  description?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="scorelab-premium-input h-10 w-full rounded-xl border px-3 text-sm text-foreground focus:outline-none"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-background text-foreground"
          >
            {option.label}
          </option>
        ))}
      </select>
      {description ? (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
