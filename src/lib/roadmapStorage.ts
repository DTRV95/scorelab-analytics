const ROADMAP_SETTINGS_KEY = "scorelab_roadmap_settings";
const ROADMAP_DAY_MEMORIES_KEY = "scorelab_roadmap_day_memories";

export interface RoadmapSettings {
  targetAmount: number;
  targetDays: number;
  startedAt: string;
}

export interface RoadmapDayMemory {
  day: number;
  date: string;
  targetStake: number;
  actualStake: number;
  targetProfit: number;
  actualProfit: number;
  tickets: number;
  activeTickets: number;
  status: string;
  classification: "disciplined" | "efficient" | "forced" | "overexposed" | "quiet";
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

export function getRoadmapDayMemories(): RoadmapDayMemory[] {
  try {
    const raw = localStorage.getItem(ROADMAP_DAY_MEMORIES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RoadmapDayMemory[];
  } catch {
    return [];
  }
}

export function overwriteRoadmapDayMemories(memories: RoadmapDayMemory[]) {
  localStorage.setItem(ROADMAP_DAY_MEMORIES_KEY, JSON.stringify(memories));
}

export function syncRoadmapDayMemories(memories: RoadmapDayMemory[]) {
  const existing = getRoadmapDayMemories();
  const nextMap = new Map(existing.map((memory) => [memory.date, memory]));

  memories.forEach((memory) => {
    nextMap.set(memory.date, memory);
  });

  overwriteRoadmapDayMemories(
    Array.from(nextMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  );
}
