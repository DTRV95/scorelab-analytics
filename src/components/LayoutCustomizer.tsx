import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { queueEntitySync } from "@/lib/persistenceSync";

export interface SectionDef {
  id: string;
  label: string;
}

interface PageLayout {
  order: string[];
  hidden: string[];
}

export interface SectionLayoutApi {
  defs: SectionDef[];
  order: string[];
  hidden: string[];
  toggle: (id: string) => void;
  move: (id: string, direction: -1 | 1) => void;
  reset: () => void;
}

const STORAGE_KEY = "scorelab_layout_settings";

function readAll(): Record<string, PageLayout> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function normalize(stored: PageLayout | undefined, defs: SectionDef[]): PageLayout {
  const ids = defs.map((d) => d.id);
  const order = [
    ...(stored?.order ?? []).filter((id) => ids.includes(id)),
    ...ids.filter((id) => !(stored?.order ?? []).includes(id)),
  ];
  const hidden = (stored?.hidden ?? []).filter((id) => ids.includes(id));
  return { order, hidden };
}

export function useSectionLayout(page: string, defs: SectionDef[]): SectionLayoutApi {
  const [layout, setLayout] = useState<PageLayout>(() => normalize(readAll()[page], defs));

  const persist = (next: PageLayout) => {
    setLayout(next);
    const all = readAll();
    all[page] = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    queueEntitySync("layout_settings");
  };

  return {
    defs,
    order: layout.order,
    hidden: layout.hidden,
    toggle: (id) =>
      persist({
        ...layout,
        hidden: layout.hidden.includes(id)
          ? layout.hidden.filter((h) => h !== id)
          : [...layout.hidden, id],
      }),
    move: (id, direction) => {
      const index = layout.order.indexOf(id);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= layout.order.length) return;
      const order = [...layout.order];
      [order[index], order[target]] = [order[target], order[index]];
      persist({ ...layout, order });
    },
    reset: () => persist(normalize(undefined, defs)),
  };
}

export function LayoutSection({
  id,
  layout,
  children,
}: {
  id: string;
  layout: SectionLayoutApi;
  children: ReactNode;
}) {
  if (layout.hidden.includes(id)) return null;
  const index = layout.order.indexOf(id);
  return (
    <div style={{ order: index + 1 }} className="flex min-w-0 flex-col gap-7">
      {children}
    </div>
  );
}

export function LayoutCustomizeButton({ layout }: { layout: SectionLayoutApi }) {
  const byId = Object.fromEntries(layout.defs.map((d) => [d.id, d]));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 rounded-2xl border text-xs"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.6} />
          Personalizar
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 rounded-2xl border-border bg-card p-3 backdrop-blur-xl"
      >
        <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Constrói o teu painel
        </p>
        <div className="space-y-1.5">
          {layout.order.map((id, index) => {
            const def = byId[id];
            if (!def) return null;
            const isHidden = layout.hidden.includes(id);
            return (
              <div
                key={id}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-2.5 py-2"
              >
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    isHidden ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {def.label}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                  disabled={index === 0}
                  onClick={() => layout.move(id, -1)}
                  title="Mover para cima"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                  disabled={index === layout.order.length - 1}
                  onClick={() => layout.move(id, 1)}
                  title="Mover para baixo"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={() => layout.toggle(id)}
                  title={isHidden ? "Mostrar secção" : "Ocultar secção"}
                >
                  {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            );
          })}
        </div>
        <button
          onClick={layout.reset}
          className="mt-2 w-full rounded-xl px-2 py-1.5 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Repor disposição original
        </button>
      </PopoverContent>
    </Popover>
  );
}
