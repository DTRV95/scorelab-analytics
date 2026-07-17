import { supabase } from "@/lib/supabaseClient";

const ANALYSES_KEY = "scorelab_analyses";
const LAST_USER_KEY = "scorelab_last_user_id";
const MULTIPLES_KEY = "scorelab_multiples";
const MULTIPLE_DRAFT_KEY = "scorelab_multiple_draft";
const BANKROLL_SETTINGS_KEY = "scorelab_bankroll_settings";
const ROADMAP_SETTINGS_KEY = "scorelab_roadmap_settings";
const ROADMAP_DAY_MEMORIES_KEY = "scorelab_roadmap_day_memories";
const ROADMAP_MISSIONS_KEY = "scorelab_roadmap_missions";
const STORAGE_METADATA_KEY = "scorelab_storage_metadata";
const STORAGE_BACKUP_KEY = "scorelab_storage_backup_latest";

const ANALYSES_UPDATED_EVENT = "scorelab:analyses-updated";
const MULTIPLES_UPDATED_EVENT = "scorelab:multiples-updated";
const PERSISTENCE_HYDRATED_EVENT = "scorelab:persistence-hydrated";

const ENTITY_CONFIG = {
  analyses: { storageKey: ANALYSES_KEY, fallback: [] as unknown[] },
  multiples: { storageKey: MULTIPLES_KEY, fallback: [] as unknown[] },
  multiple_draft: { storageKey: MULTIPLE_DRAFT_KEY, fallback: [] as unknown[] },
  bankroll_settings: {
    storageKey: BANKROLL_SETTINGS_KEY,
    fallback: {} as Record<string, unknown>,
  },
  roadmap_settings: {
    storageKey: ROADMAP_SETTINGS_KEY,
    fallback: {} as Record<string, unknown>,
  },
  roadmap_day_memories: {
    storageKey: ROADMAP_DAY_MEMORIES_KEY,
    fallback: [] as unknown[],
  },
  roadmap_missions: {
    storageKey: ROADMAP_MISSIONS_KEY,
    fallback: [] as unknown[],
  },
} as const;

type EntityKey = keyof typeof ENTITY_CONFIG;
type AnalysisRecordPayload = Record<string, unknown> & { id: string };
type MultipleRecordPayload = Record<string, unknown> & { id: string };

interface EntityMetadata {
  schema_version: number;
  updated_at: string;
  client_id: string | null;
  entity_key: EntityKey;
}

export interface EntityStatePayload {
  metadata: EntityMetadata;
  data: unknown;
}

export interface StorageSnapshotPayload {
  metadata: {
    schema_version: number;
    updated_at: string;
    client_id: string | null;
  };
  analyses: unknown[];
  multiples: unknown[];
  multiple_draft: unknown[];
  bankroll_settings: Record<string, unknown>;
  roadmap_settings: Record<string, unknown>;
  roadmap_day_memories: unknown[];
  roadmap_missions: unknown[];
}

let queuedPersistTimeout: number | null = null;
let persistInFlight = false;
const queuedEntityTimeouts = new Map<EntityKey, number>();
const entitySyncInFlight = new Set<EntityKey>();
const LOCAL_RESET_KEYS = [
  ANALYSES_KEY,
  MULTIPLES_KEY,
  MULTIPLE_DRAFT_KEY,
  BANKROLL_SETTINGS_KEY,
  ROADMAP_SETTINGS_KEY,
  ROADMAP_DAY_MEMORIES_KEY,
  ROADMAP_MISSIONS_KEY,
  STORAGE_METADATA_KEY,
  STORAGE_BACKUP_KEY,
  `${STORAGE_METADATA_KEY}_snapshot`,
] as const;

let lastHydratedUserId: string | null = null;

async function getAuthedUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured");
  const userId = await getAuthedUserId();
  if (!userId) throw new Error("Not signed in");
  return supabase;
}

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

function getStoredBackupSnapshot() {
  return readJson<StorageSnapshotPayload | null>(STORAGE_BACKUP_KEY, null);
}

function setSnapshotMetadata(metadata: StorageSnapshotPayload["metadata"]) {
  writeJson(`${STORAGE_METADATA_KEY}_snapshot`, metadata);
}

function getEntityMetadataStorageKey(entityKey: EntityKey) {
  return `${STORAGE_METADATA_KEY}_entity_${entityKey}`;
}

function setEntityMetadata(entityKey: EntityKey, metadata: EntityMetadata) {
  writeJson(getEntityMetadataStorageKey(entityKey), metadata);
}

function clearEntityMetadata() {
  (Object.keys(ENTITY_CONFIG) as EntityKey[]).forEach((entityKey) => {
    localStorage.removeItem(getEntityMetadataStorageKey(entityKey));
  });
}

function getClientId() {
  const existing = readJson<string | null>(STORAGE_METADATA_KEY, null);
  if (existing) return existing;

  const next = `client_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  writeJson(STORAGE_METADATA_KEY, next);
  return next;
}

function getSnapshotUpdatedAt(snapshot: StorageSnapshotPayload) {
  return Date.parse(snapshot.metadata?.updated_at || "");
}

function getEntityUpdatedAt(entity: EntityStatePayload) {
  return Date.parse(entity.metadata?.updated_at || "");
}

function getLocalEntityState<T = unknown>(entityKey: EntityKey): EntityStatePayload {
  const config = ENTITY_CONFIG[entityKey];
  const metadata = readJson<EntityMetadata | null>(
    getEntityMetadataStorageKey(entityKey),
    null
  );

  return {
    metadata: metadata ?? {
      schema_version: 1,
      updated_at: new Date(0).toISOString(),
      client_id: getClientId(),
      entity_key: entityKey,
    },
    data: readJson<T>(config.storageKey, config.fallback as T),
  };
}

function buildOutboundEntityState(entityKey: EntityKey): EntityStatePayload {
  const current = getLocalEntityState(entityKey);

  return {
    ...current,
    metadata: {
      schema_version: 1,
      updated_at: new Date().toISOString(),
      client_id: getClientId(),
      entity_key: entityKey,
    },
  };
}

export function getLocalStorageSnapshot(): StorageSnapshotPayload {
  const storedMetadata = readJson<StorageSnapshotPayload["metadata"] | null>(
    `${STORAGE_METADATA_KEY}_snapshot`,
    null
  );

  return {
    metadata: storedMetadata ?? {
      schema_version: 1,
      updated_at: new Date(0).toISOString(),
      client_id: getClientId(),
    },
    analyses: readJson(ANALYSES_KEY, []),
    multiples: readJson(MULTIPLES_KEY, []),
    multiple_draft: readJson(MULTIPLE_DRAFT_KEY, []),
    bankroll_settings: readJson(BANKROLL_SETTINGS_KEY, {}),
    roadmap_settings: readJson(ROADMAP_SETTINGS_KEY, {}),
    roadmap_day_memories: readJson(ROADMAP_DAY_MEMORIES_KEY, []),
    roadmap_missions: readJson(ROADMAP_MISSIONS_KEY, []),
  };
}

function snapshotHasMeaningfulData(snapshot: StorageSnapshotPayload) {
  return (
    snapshot.analyses.length > 0 ||
    snapshot.multiples.length > 0 ||
    snapshot.multiple_draft.length > 0 ||
    Object.keys(snapshot.bankroll_settings).length > 0 ||
    Object.keys(snapshot.roadmap_settings).length > 0 ||
    snapshot.roadmap_day_memories.length > 0 ||
    snapshot.roadmap_missions.length > 0
  );
}

function entityHasMeaningfulData(entity: EntityStatePayload) {
  if (Array.isArray(entity.data)) return entity.data.length > 0;
  if (entity.data && typeof entity.data === "object") {
    return Object.keys(entity.data as Record<string, unknown>).length > 0;
  }
  return Boolean(entity.data);
}

function backupLocalSnapshotIfMeaningful() {
  const snapshot = getLocalStorageSnapshot();
  if (!snapshotHasMeaningfulData(snapshot)) return;

  const currentBackup = getStoredBackupSnapshot();
  if (
    currentBackup &&
    getSnapshotUpdatedAt(currentBackup) >= getSnapshotUpdatedAt(snapshot)
  ) {
    return;
  }

  writeJson(STORAGE_BACKUP_KEY, snapshot);
}

function canApplyIncomingEntityState(entityKey: EntityKey, entity: EntityStatePayload) {
  const localEntity = getLocalEntityState(entityKey);

  if (entityHasMeaningfulData(entity)) {
    return true;
  }

  return !entityHasMeaningfulData(localEntity);
}

function dispatchPersistenceEvents(entityKey?: EntityKey) {
  if (!entityKey || entityKey === "analyses") {
    window.dispatchEvent(new CustomEvent(ANALYSES_UPDATED_EVENT));
  }

  if (
    !entityKey ||
    entityKey === "multiples" ||
    entityKey === "multiple_draft"
  ) {
    window.dispatchEvent(new CustomEvent(MULTIPLES_UPDATED_EVENT));
  }

  window.dispatchEvent(new CustomEvent(PERSISTENCE_HYDRATED_EVENT));
}

export function applyEntityState(entityKey: EntityKey, entity: EntityStatePayload) {
  const config = ENTITY_CONFIG[entityKey];
  if (!canApplyIncomingEntityState(entityKey, entity)) {
    return false;
  }

  backupLocalSnapshotIfMeaningful();
  setEntityMetadata(entityKey, entity.metadata);
  writeJson(config.storageKey, entity.data);
  dispatchPersistenceEvents(entityKey);
  return true;
}

export function applyStorageSnapshot(snapshot: StorageSnapshotPayload) {
  backupLocalSnapshotIfMeaningful();
  setSnapshotMetadata(snapshot.metadata);

  (Object.keys(ENTITY_CONFIG) as EntityKey[]).forEach((entityKey) => {
    applyEntityState(entityKey, {
      metadata: {
        schema_version: snapshot.metadata.schema_version,
        updated_at: snapshot.metadata.updated_at,
        client_id: snapshot.metadata.client_id,
        entity_key: entityKey,
      },
      data: snapshot[entityKey],
    });
  });
}

function applyAnalysesList(analyses: unknown[]) {
  writeJson(ANALYSES_KEY, analyses);
  dispatchPersistenceEvents("analyses");
}

function patchAnalysisInLocalStorage(analysis: Record<string, unknown> & { id: string }) {
  const analyses = readJson<Array<Record<string, unknown> & { id: string }>>(ANALYSES_KEY, []);
  const existingIndex = analyses.findIndex((item) => item.id === analysis.id);

  if (existingIndex === -1) {
    writeJson(ANALYSES_KEY, [analysis, ...analyses]);
  } else {
    const next = [...analyses];
    next[existingIndex] = analysis;
    writeJson(ANALYSES_KEY, next);
  }

  dispatchPersistenceEvents("analyses");
}

function patchMultipleInLocalStorage(multiple: Record<string, unknown> & { id: string }) {
  const multiples = readJson<Array<Record<string, unknown> & { id: string }>>(MULTIPLES_KEY, []);
  const existingIndex = multiples.findIndex((item) => item.id === multiple.id);

  if (existingIndex === -1) {
    writeJson(MULTIPLES_KEY, [multiple, ...multiples]);
  } else {
    const next = [...multiples];
    next[existingIndex] = multiple;
    writeJson(MULTIPLES_KEY, next);
  }

  dispatchPersistenceEvents("multiples");
}


interface StaleGuardedSaveResult {
  payload: unknown;
  was_stale: boolean;
}

async function persistEntityToServer(entityKey: EntityKey, entity: EntityStatePayload) {
  const client = await requireClient();
  const { data, error } = await client.rpc("save_entity_state", {
    p_entity_key: entityKey,
    p_payload: entity,
    p_updated_at: entity.metadata.updated_at,
  });

  if (error) {
    throw new Error(`Failed to persist entity ${entityKey} (${error.message})`);
  }

  const result = data as unknown as StaleGuardedSaveResult;
  return {
    entity: result.payload as EntityStatePayload,
    ignored_due_to_staleness: result.was_stale,
  };
}

async function fetchAnalysisRecordsFromServer() {
  const client = await requireClient();
  const { data, error } = await client
    .from("user_analyses")
    .select("id, payload, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch analyses (${error.message})`);
  }

  return {
    analyses: (data ?? []) as Array<{
      id: string;
      payload: Record<string, unknown>;
      created_at?: string | null;
      updated_at?: string | null;
    }>,
  };
}

async function fetchMultipleRecordsFromServer() {
  const client = await requireClient();
  const { data, error } = await client
    .from("user_multiples")
    .select("id, payload, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch multiples (${error.message})`);
  }

  return {
    multiples: (data ?? []) as Array<{
      id: string;
      payload: Record<string, unknown>;
      created_at?: string | null;
      updated_at?: string | null;
    }>,
  };
}

export async function hydrateAnalysesFromServer() {
  const localAnalyses = readJson<unknown[]>(ANALYSES_KEY, []);

  try {
    const data = await fetchAnalysisRecordsFromServer();
    const remoteAnalyses = data.analyses.map((record) => record.payload);

    if (remoteAnalyses.length > 0) {
      backupLocalSnapshotIfMeaningful();
      applyAnalysesList(remoteAnalyses);
      setEntityMetadata("analyses", {
        schema_version: 1,
        updated_at: new Date().toISOString(),
        client_id: getClientId(),
        entity_key: "analyses",
      });
      queueEntitySync("analyses");
      return { hydrated: true, source: "analysis-records" as const };
    }

    if (localAnalyses.length > 0) {
      return { hydrated: true, source: "local-analyses-retained" as const };
    }

    return { hydrated: true, source: "empty-analyses" as const };
  } catch {
    return { hydrated: false, source: "offline" as const };
  }
}

export function persistAnalysisRecord(analysis: AnalysisRecordPayload) {
  requireClient()
    .then((client) =>
      client.rpc("save_user_analysis", {
        p_id: analysis.id,
        p_payload: analysis,
        p_updated_at: new Date().toISOString(),
      })
    )
    .then(({ data, error }) => {
      if (error) {
        throw new Error(`Failed to persist analysis ${analysis.id}`);
      }

      const result = data as unknown as StaleGuardedSaveResult;
      if (result.was_stale && result.payload) {
        patchAnalysisInLocalStorage(
          result.payload as Record<string, unknown> & { id: string }
        );
      }
    })
    .catch(() => {
      // Keep local write path non-blocking if backend is unavailable.
    });
}

export function deleteAnalysisRecord(analysisId: string) {
  return requireClient()
    .then((client) => client.from("user_analyses").delete().eq("id", analysisId))
    .catch(() => {
      // Keep local delete path non-blocking if backend is unavailable.
    });
}

export async function hydrateMultiplesFromServer() {
  const localMultiples = readJson<unknown[]>(MULTIPLES_KEY, []);

  try {
    const data = await fetchMultipleRecordsFromServer();
    const remoteMultiples = data.multiples.map((record) => record.payload);

    if (remoteMultiples.length > 0) {
      backupLocalSnapshotIfMeaningful();
      writeJson(MULTIPLES_KEY, remoteMultiples);
      dispatchPersistenceEvents("multiples");
      setEntityMetadata("multiples", {
        schema_version: 1,
        updated_at: new Date().toISOString(),
        client_id: getClientId(),
        entity_key: "multiples",
      });
      queueEntitySync("multiples");
      return { hydrated: true, source: "multiple-records" as const };
    }

    if (localMultiples.length > 0) {
      return { hydrated: true, source: "local-multiples-retained" as const };
    }

    return { hydrated: true, source: "empty-multiples" as const };
  } catch {
    return { hydrated: false, source: "offline" as const };
  }
}

export function persistMultipleRecord(multiple: MultipleRecordPayload) {
  requireClient()
    .then((client) =>
      client.rpc("save_user_multiple", {
        p_id: multiple.id,
        p_payload: multiple,
        p_updated_at: new Date().toISOString(),
      })
    )
    .then(({ data, error }) => {
      if (error) {
        throw new Error(`Failed to persist multiple ${multiple.id}`);
      }

      const result = data as unknown as StaleGuardedSaveResult;
      if (result.was_stale && result.payload) {
        patchMultipleInLocalStorage(
          result.payload as Record<string, unknown> & { id: string }
        );
      }
    })
    .catch(() => {
      // Keep local write path non-blocking if backend is unavailable.
    });
}

export function deleteMultipleRecord(multipleId: string) {
  return requireClient()
    .then((client) => client.from("user_multiples").delete().eq("id", multipleId))
    .catch(() => {
      // Keep local delete path non-blocking if backend is unavailable.
    });
}

export function queueEntitySync(entityKey: EntityKey) {
  if (typeof window === "undefined") return;

  const existing = queuedEntityTimeouts.get(entityKey);
  if (typeof existing === "number") {
    window.clearTimeout(existing);
  }

  const nextTimeout = window.setTimeout(async () => {
    if (entitySyncInFlight.has(entityKey)) return;

    entitySyncInFlight.add(entityKey);
    try {
      const outbound = buildOutboundEntityState(entityKey);
      const result = await persistEntityToServer(entityKey, outbound);

      if (result.ignored_due_to_staleness) {
        applyEntityState(entityKey, result.entity);
      } else {
        setEntityMetadata(entityKey, outbound.metadata);
      }
    } catch {
      // Keep local cache usable even if backend sync is unavailable.
    } finally {
      entitySyncInFlight.delete(entityKey);
      queuedEntityTimeouts.delete(entityKey);
    }
  }, 250);

  queuedEntityTimeouts.set(entityKey, nextTimeout);
}

async function hydrateEntitiesFromServer() {
  backupLocalSnapshotIfMeaningful();
  const client = await requireClient();
  const { data, error } = await client
    .from("user_entity_state")
    .select("entity_key, payload");

  if (error) {
    throw new Error(`Failed to hydrate entity storage (${error.message})`);
  }

  const remoteEntities = Object.fromEntries(
    (data ?? []).map((row) => [row.entity_key as EntityKey, row.payload as EntityStatePayload])
  ) as Partial<Record<EntityKey, EntityStatePayload>>;
  const entityKeys = Object.keys(ENTITY_CONFIG) as EntityKey[];
  let anyRemoteApplied = false;
  let anyLocalPushed = false;
  let anyRemoteMeaningful = false;

  for (const entityKey of entityKeys) {
    const remoteEntity = remoteEntities[entityKey];
    const localEntity = getLocalEntityState(entityKey);

    if (remoteEntity && entityHasMeaningfulData(remoteEntity)) {
      anyRemoteMeaningful = true;
    }

    if (
      remoteEntity &&
      entityHasMeaningfulData(remoteEntity) &&
      getEntityUpdatedAt(remoteEntity) >= getEntityUpdatedAt(localEntity)
    ) {
      applyEntityState(entityKey, remoteEntity);
      anyRemoteApplied = true;
      continue;
    }

    if (entityHasMeaningfulData(localEntity)) {
      const outbound = buildOutboundEntityState(entityKey);
      const result = await persistEntityToServer(entityKey, outbound);

      if (result.ignored_due_to_staleness) {
        applyEntityState(entityKey, result.entity);
        anyRemoteApplied = true;
      } else {
        setEntityMetadata(entityKey, outbound.metadata);
        anyLocalPushed = true;
      }
    }
  }

  if (anyRemoteApplied) return { hydrated: true, source: "remote-entities" as const };
  if (anyLocalPushed) return { hydrated: true, source: "local-entities-pushed" as const };
  if (!anyRemoteMeaningful) {
    const backupSnapshot = getStoredBackupSnapshot();
    if (backupSnapshot && snapshotHasMeaningfulData(backupSnapshot)) {
      applyStorageSnapshot(backupSnapshot);
      return { hydrated: true, source: "backup-restored" as const };
    }
  }
  return { hydrated: true, source: "empty-entities" as const };
}

export function clearLocalScorelabData() {
  lastHydratedUserId = null;
  localStorage.removeItem(LAST_USER_KEY);
  LOCAL_RESET_KEYS.forEach((key) => {
    localStorage.removeItem(key);
  });
  clearEntityMetadata();
  dispatchPersistenceEvents();
}

export async function hydrateStorageFromServer() {
  const userId = await getAuthedUserId();
  if (!userId) {
    return { hydrated: false, source: "signed-out" as const };
  }

  if (lastHydratedUserId === userId) {
    return { hydrated: true, source: "already-hydrated" as const };
  }

  // A different account was using this browser: never merge or push its
  // local data into the new account. Start clean and pull from the server.
  const previousUserId = readJson<string | null>(LAST_USER_KEY, null);
  if (previousUserId && previousUserId !== userId) {
    clearLocalScorelabData();
  }
  writeJson(LAST_USER_KEY, userId);

  try {
    const entityResult = await hydrateEntitiesFromServer();

    const currentAnalyses = readJson<unknown[]>(ANALYSES_KEY, []);
    const currentMultiples = readJson<unknown[]>(MULTIPLES_KEY, []);

    if (currentAnalyses.length === 0) {
      await hydrateAnalysesFromServer();
    }

    if (currentMultiples.length === 0) {
      await hydrateMultiplesFromServer();
    }

    lastHydratedUserId = userId;
    return entityResult;
  } catch {
    return { hydrated: false, source: "offline" as const };
  }
}

export { PERSISTENCE_HYDRATED_EVENT };

export async function resetAllScorelabData() {
  // Delete only the signed-in user's rows; RLS scopes every statement.
  try {
    const client = await requireClient();
    await Promise.allSettled([
      client.from("user_entity_state").delete().neq("entity_key", ""),
      client.from("user_analyses").delete().neq("id", ""),
      client.from("user_multiples").delete().neq("id", ""),
    ]);
  } catch {
    // Still reset the local cache even if the server is unreachable.
  }

  if (typeof window !== "undefined") {
    if (queuedPersistTimeout !== null) {
      window.clearTimeout(queuedPersistTimeout);
      queuedPersistTimeout = null;
    }

    queuedEntityTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
  }

  persistInFlight = false;
  entitySyncInFlight.clear();
  queuedEntityTimeouts.clear();

  LOCAL_RESET_KEYS.forEach((key) => {
    localStorage.removeItem(key);
  });
  clearEntityMetadata();

  dispatchPersistenceEvents();
}
