export type ScoreLabAppearance =
  | "sporting"
  | "porto"
  | "benfica"
  | "real-madrid"
  | "borussia-dortmund"
  | "barcelona";

export interface AppearancePreset {
  id: ScoreLabAppearance;
  name: string;
  description: string;
  accent: string;
  previewClassName: string;
}

const APPEARANCE_KEY = "scorelab_appearance";
const APPEARANCE_DEFAULT_MIGRATION_KEY = "scorelab_appearance_default_real_madrid_v1";
const DEFAULT_APPEARANCE: ScoreLabAppearance = "real-madrid";
export const APPEARANCE_UPDATED_EVENT = "scorelab:appearance-updated";

export const appearancePresets: AppearancePreset[] = [
  {
    id: "sporting",
    name: "Sporting CP",
    description: "Green and white matchday clarity.",
    accent: "Green / White",
    previewClassName:
      "bg-[radial-gradient(circle_at_18%_18%,rgba(22,163,74,0.62),transparent_34%),radial-gradient(circle_at_78%_24%,rgba(240,253,244,0.38),transparent_30%),linear-gradient(135deg,#052016,#f8fafc)]",
  },
  {
    id: "porto",
    name: "FC Porto",
    description: "Blue and white European night atmosphere.",
    accent: "Blue / White",
    previewClassName:
      "bg-[radial-gradient(circle_at_20%_18%,rgba(37,99,235,0.66),transparent_34%),radial-gradient(circle_at_80%_28%,rgba(241,245,249,0.34),transparent_30%),linear-gradient(135deg,#031636,#f8fafc)]",
  },
  {
    id: "benfica",
    name: "SL Benfica",
    description: "Red stadium energy with gold highlights.",
    accent: "Red / Gold",
    previewClassName:
      "bg-[radial-gradient(circle_at_20%_18%,rgba(220,38,38,0.66),transparent_34%),radial-gradient(circle_at_80%_28%,rgba(245,158,11,0.42),transparent_30%),linear-gradient(135deg,#2a0508,#12070a)]",
  },
  {
    id: "real-madrid",
    name: "Real Madrid",
    description: "White, navy and gold final-night polish.",
    accent: "White / Gold",
    previewClassName:
      "bg-[radial-gradient(circle_at_18%_18%,rgba(250,204,21,0.42),transparent_34%),radial-gradient(circle_at_78%_28%,rgba(59,130,246,0.32),transparent_30%),linear-gradient(135deg,#f8fafc,#07111f)]",
  },
  {
    id: "borussia-dortmund",
    name: "Borussia Dortmund",
    description: "Electric yellow and black high-pressure mode.",
    accent: "Yellow / Black",
    previewClassName:
      "bg-[radial-gradient(circle_at_18%_18%,rgba(250,204,21,0.74),transparent_34%),radial-gradient(circle_at_78%_28%,rgba(15,23,42,0.64),transparent_30%),linear-gradient(135deg,#facc15,#050505)]",
  },
  {
    id: "barcelona",
    name: "FC Barcelona",
    description: "Deep blue and red creative football pulse.",
    accent: "Blue / Crimson",
    previewClassName:
      "bg-[radial-gradient(circle_at_18%_18%,rgba(37,99,235,0.62),transparent_34%),radial-gradient(circle_at_78%_28%,rgba(190,18,60,0.54),transparent_30%),linear-gradient(135deg,#07143a,#280514)]",
  },
];

export function getScoreLabAppearance(): ScoreLabAppearance {
  try {
    const stored = localStorage.getItem(APPEARANCE_KEY) as ScoreLabAppearance | null;
    const migrated = localStorage.getItem(APPEARANCE_DEFAULT_MIGRATION_KEY);

    if ((!stored || stored === "sporting") && !migrated) {
      localStorage.setItem(APPEARANCE_KEY, DEFAULT_APPEARANCE);
      localStorage.setItem(APPEARANCE_DEFAULT_MIGRATION_KEY, "true");
      return DEFAULT_APPEARANCE;
    }

    if (stored && appearancePresets.some((preset) => preset.id === stored)) {
      return stored;
    }
  } catch {
    return DEFAULT_APPEARANCE;
  }

  return DEFAULT_APPEARANCE;
}

export function applyScoreLabAppearance(appearance: ScoreLabAppearance) {
  document.documentElement.dataset.scorelabAppearance = appearance;
}

export function saveScoreLabAppearance(appearance: ScoreLabAppearance) {
  localStorage.setItem(APPEARANCE_KEY, appearance);
  applyScoreLabAppearance(appearance);
  window.dispatchEvent(new CustomEvent(APPEARANCE_UPDATED_EVENT, { detail: appearance }));
}
