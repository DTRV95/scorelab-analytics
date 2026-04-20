const ROADMAP_SETTINGS_KEY = "scorelab_roadmap_settings";

export interface RoadmapSettings {
  targetAmount: number;
  targetDays: number;
  startedAt: string;
}

export const DEFAULT_ROADMAP_SETTINGS: RoadmapSettings = {
  targetAmount: 150,
  targetDays: 30,
  startedAt: new Date().toISOString(),
};

export function getRoadmapSettings(): RoadmapSettings {
  try {
    const raw = localStorage.getItem(ROADMAP_SETTINGS_KEY);
    if (!raw) return DEFAULT_ROADMAP_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<RoadmapSettings>;

    return {
      targetAmount:
        typeof parsed.targetAmount === "number" && parsed.targetAmount > 0
          ? parsed.targetAmount
          : DEFAULT_ROADMAP_SETTINGS.targetAmount,
      targetDays:
        typeof parsed.targetDays === "number" && parsed.targetDays > 0
          ? parsed.targetDays
          : DEFAULT_ROADMAP_SETTINGS.targetDays,
      startedAt:
        typeof parsed.startedAt === "string" && parsed.startedAt.trim().length > 0
          ? parsed.startedAt
          : DEFAULT_ROADMAP_SETTINGS.startedAt,
    };
  } catch {
    return DEFAULT_ROADMAP_SETTINGS;
  }
}

export function saveRoadmapSettings(settings: RoadmapSettings) {
  localStorage.setItem(ROADMAP_SETTINGS_KEY, JSON.stringify(settings));
}
