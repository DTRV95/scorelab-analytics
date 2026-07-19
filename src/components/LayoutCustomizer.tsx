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
          className="scorelab-chrome-control h-9 gap-2 rounded-2xl border text-xs"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.6} />
          Personalizar
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(8,23,42,0.98),rgba(4,12,24,0.99))] p-3 backdrop-blur-xl"
      >
        <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
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
                className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2"
              >
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    isHidden ? "text-white/35 line-through" : "text-white/85"
                  }`}
                >
                  {def.label}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-white/55 hover:text-white"
                  disabled={index === 0}
                  onClick={() => layout.move(id, -1)}
                  title="Mover para cima"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-white/55 hover:text-white"
                  disabled={index === layout.order.length - 1}
                  onClick={() => layout.move(id, 1)}
                  title="Mover para baixo"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-white/55 hover:text-white"
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
          className="mt-2 w-full rounded-xl px-2 py-1.5 text-center text-xs text-white/45 transition-colors hover:text-white/80"
        >
          Repor disposição original
        </button>
      </PopoverContent>
    </Popover>
  );
}
