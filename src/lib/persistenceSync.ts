const API_BASE_URL = "http://localhost:8000";

const ANALYSES_KEY = "scorelab_analyses";
const MULTIPLES_KEY = "scorelab_multiples";
const MULTIPLE_DRAFT_KEY = "scorelab_multiple_draft";
const BANKROLL_SETTINGS_KEY = "scorelab_bankroll_settings";
const ROADMAP_SETTINGS_KEY = "scorelab_roadmap_settings";
const ROADMAP_DAY_MEMORIES_KEY = "scorelab_roadmap_day_memories";

const ANALYSES_UPDATED_EVENT = "scorelab:analyses-updated";
const MULTIPLES_UPDATED_EVENT = "scorelab:multiples-updated";
const PERSISTENCE_HYDRATED_EVENT = "scorelab:persistence-hydrated";

export interface StorageSnapshotPayload {
  analyses: unknown[];
  multiples: unknown[];
  multiple_draft: unknown[];
  bankroll_settings: Record<string, unknown>;
  roadmap_settings: Record<string, unknown>;
  roadmap_day_memories: unknown[];
}

let queuedPersistTimeout: number | null = null;
let persistInFlight = false;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getLocalStorageSnapshot(): StorageSnapshotPayload {
  return {
    analyses: readJson(ANALYSES_KEY, []),
    multiples: readJson(MULTIPLES_KEY, []),
    multiple_draft: readJson(MULTIPLE_DRAFT_KEY, []),
    bankroll_settings: readJson(BANKROLL_SETTINGS_KEY, {}),
    roadmap_settings: readJson(ROADMAP_SETTINGS_KEY, {}),
    roadmap_day_memories: readJson(ROADMAP_DAY_MEMORIES_KEY, []),
  };
}

function snapshotHasMeaningfulData(snapshot: StorageSnapshotPayload) {
  return (
    snapshot.analyses.length > 0 ||
    snapshot.multiples.length > 0 ||
    snapshot.multiple_draft.length > 0 ||
    Object.keys(snapshot.bankroll_settings).length > 0 ||
    Object.keys(snapshot.roadmap_settings).length > 0 ||
    snapshot.roadmap_day_memories.length > 0
  );
}

export function applyStorageSnapshot(snapshot: StorageSnapshotPayload) {
  writeJson(ANALYSES_KEY, snapshot.analyses);
  writeJson(MULTIPLES_KEY, snapshot.multiples);
  writeJson(MULTIPLE_DRAFT_KEY, snapshot.multiple_draft);
  writeJson(BANKROLL_SETTINGS_KEY, snapshot.bankroll_settings);
  writeJson(ROADMAP_SETTINGS_KEY, snapshot.roadmap_settings);
  writeJson(ROADMAP_DAY_MEMORIES_KEY, snapshot.roadmap_day_memories);

  window.dispatchEvent(new CustomEvent(ANALYSES_UPDATED_EVENT));
  window.dispatchEvent(new CustomEvent(MULTIPLES_UPDATED_EVENT));
  window.dispatchEvent(new CustomEvent(PERSISTENCE_HYDRATED_EVENT));
}

async function persistSnapshotToServer(snapshot: StorageSnapshotPayload) {
  await fetch(`${API_BASE_URL}/storage/snapshot`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(snapshot),
  });
}

export function queueStorageSnapshotSync() {
  if (typeof window === "undefined") return;

  if (queuedPersistTimeout !== null) {
    window.clearTimeout(queuedPersistTimeout);
  }

  queuedPersistTimeout = window.setTimeout(async () => {
    if (persistInFlight) return;

    persistInFlight = true;
    try {
      await persistSnapshotToServer(getLocalStorageSnapshot());
    } catch {
      // Keep local cache usable even if backend sync is unavailable.
    } finally {
      persistInFlight = false;
      queuedPersistTimeout = null;
    }
  }, 350);
}

export async function hydrateStorageFromServer() {
  try {
    const response = await fetch(`${API_BASE_URL}/storage/snapshot`);
    if (!response.ok) {
      throw new Error(`Failed to hydrate storage (${response.status})`);
    }

    const data = (await response.json()) as { snapshot: StorageSnapshotPayload };
    const remoteSnapshot = data.snapshot;
    const localSnapshot = getLocalStorageSnapshot();

    if (snapshotHasMeaningfulData(remoteSnapshot)) {
      applyStorageSnapshot(remoteSnapshot);
      return { hydrated: true, source: "remote" as const };
    }

    if (snapshotHasMeaningfulData(localSnapshot)) {
      await persistSnapshotToServer(localSnapshot);
      return { hydrated: true, source: "local-pushed" as const };
    }

    return { hydrated: true, source: "empty" as const };
  } catch {
    return { hydrated: false, source: "offline" as const };
  }
}

export { PERSISTENCE_HYDRATED_EVENT };
