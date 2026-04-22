import { buildApiUrl } from "@/lib/apiConfig";

const ANALYSES_KEY = "scorelab_analyses";
const MULTIPLES_KEY = "scorelab_multiples";
const MULTIPLE_DRAFT_KEY = "scorelab_multiple_draft";
const BANKROLL_SETTINGS_KEY = "scorelab_bankroll_settings";
const ROADMAP_SETTINGS_KEY = "scorelab_roadmap_settings";
const ROADMAP_DAY_MEMORIES_KEY = "scorelab_roadmap_day_memories";
const STORAGE_METADATA_KEY = "scorelab_storage_metadata";

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
}

let queuedPersistTimeout: number | null = null;
let persistInFlight = false;
const queuedEntityTimeouts = new Map<EntityKey, number>();
const entitySyncInFlight = new Set<EntityKey>();

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

function setSnapshotMetadata(metadata: StorageSnapshotPayload["metadata"]) {
  writeJson(`${STORAGE_METADATA_KEY}_snapshot`, metadata);
}

function getEntityMetadataStorageKey(entityKey: EntityKey) {
  return `${STORAGE_METADATA_KEY}_entity_${entityKey}`;
}

function setEntityMetadata(entityKey: EntityKey, metadata: EntityMetadata) {
  writeJson(getEntityMetadataStorageKey(entityKey), metadata);
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

function entityHasMeaningfulData(entity: EntityStatePayload) {
  if (Array.isArray(entity.data)) return entity.data.length > 0;
  if (entity.data && typeof entity.data === "object") {
    return Object.keys(entity.data as Record<string, unknown>).length > 0;
  }
  return Boolean(entity.data);
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
  setEntityMetadata(entityKey, entity.metadata);
  writeJson(config.storageKey, entity.data);
  dispatchPersistenceEvents(entityKey);
}

export function applyStorageSnapshot(snapshot: StorageSnapshotPayload) {
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

function buildOutboundSnapshot(): StorageSnapshotPayload {
  const current = getLocalStorageSnapshot();
  return {
    ...current,
    metadata: {
      schema_version: 1,
      updated_at: new Date().toISOString(),
      client_id: getClientId(),
    },
  };
}

async function persistSnapshotToServer(snapshot: StorageSnapshotPayload) {
  const response = await fetch(buildApiUrl("/storage/snapshot"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(snapshot),
  });

  if (!response.ok) {
    throw new Error(`Failed to persist snapshot (${response.status})`);
  }

  return (await response.json()) as {
    snapshot: StorageSnapshotPayload;
    ignored_due_to_staleness: boolean;
  };
}

async function persistEntityToServer(entityKey: EntityKey, entity: EntityStatePayload) {
  const response = await fetch(buildApiUrl(`/storage/entities/${entityKey}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(entity),
  });

  if (!response.ok) {
    throw new Error(`Failed to persist entity ${entityKey} (${response.status})`);
  }

  return (await response.json()) as {
    entity: EntityStatePayload;
    ignored_due_to_staleness: boolean;
  };
}

async function fetchAnalysisRecordsFromServer() {
  const response = await fetch(buildApiUrl("/storage/analyses"));
  if (!response.ok) {
    throw new Error(`Failed to fetch analyses (${response.status})`);
  }

  return (await response.json()) as {
    analyses: Array<{
      id: string;
      payload: Record<string, unknown>;
      created_at?: string | null;
      updated_at?: string | null;
    }>;
  };
}

export async function hydrateAnalysesFromServer() {
  const localAnalyses = readJson<unknown[]>(ANALYSES_KEY, []);

  try {
    const data = await fetchAnalysisRecordsFromServer();
    const remoteAnalyses = data.analyses.map((record) => record.payload);

    if (remoteAnalyses.length > 0) {
      applyAnalysesList(remoteAnalyses);
      setEntityMetadata("analyses", {
        schema_version: 1,
        updated_at: new Date().toISOString(),
        client_id: getClientId(),
        entity_key: "analyses",
      });
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
  fetch(buildApiUrl(`/storage/analyses/${analysis.id}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: analysis.id,
      payload: analysis,
      updated_at: new Date().toISOString(),
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to persist analysis ${analysis.id}`);
      }

      return (await response.json()) as {
        analysis: {
          id: string;
          payload: Record<string, unknown>;
          updated_at?: string | null;
        };
        ignored_due_to_staleness: boolean;
      };
    })
    .then((result) => {
      if (result.ignored_due_to_staleness && result.analysis?.payload) {
        patchAnalysisInLocalStorage(
          result.analysis.payload as Record<string, unknown> & { id: string }
        );
      }
    })
    .catch(() => {
      // Keep local write path non-blocking if backend is unavailable.
    });
}

export function deleteAnalysisRecord(analysisId: string) {
  fetch(buildApiUrl(`/storage/analyses/${analysisId}`), {
    method: "DELETE",
  }).catch(() => {
    // Keep local delete path non-blocking if backend is unavailable.
  });
}

async function fetchMultipleRecordsFromServer() {
  const response = await fetch(buildApiUrl("/storage/multiples"));
  if (!response.ok) {
    throw new Error(`Failed to fetch multiples (${response.status})`);
  }

  return (await response.json()) as {
    multiples: Array<{
      id: string;
      payload: Record<string, unknown>;
      created_at?: string | null;
      updated_at?: string | null;
    }>;
  };
}

export async function hydrateMultiplesFromServer() {
  const localMultiples = readJson<unknown[]>(MULTIPLES_KEY, []);

  try {
    const data = await fetchMultipleRecordsFromServer();
    const remoteMultiples = data.multiples.map((record) => record.payload);

    if (remoteMultiples.length > 0) {
      writeJson(MULTIPLES_KEY, remoteMultiples);
      dispatchPersistenceEvents("multiples");
      setEntityMetadata("multiples", {
        schema_version: 1,
        updated_at: new Date().toISOString(),
        client_id: getClientId(),
        entity_key: "multiples",
      });
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
  fetch(buildApiUrl(`/storage/multiples/${multiple.id}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: multiple.id,
      payload: multiple,
      updated_at: new Date().toISOString(),
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to persist multiple ${multiple.id}`);
      }

      return (await response.json()) as {
        multiple: {
          id: string;
          payload: Record<string, unknown>;
          updated_at?: string | null;
        };
        ignored_due_to_staleness: boolean;
      };
    })
    .then((result) => {
      if (result.ignored_due_to_staleness && result.multiple?.payload) {
        patchMultipleInLocalStorage(
          result.multiple.payload as Record<string, unknown> & { id: string }
        );
      }
    })
    .catch(() => {
      // Keep local write path non-blocking if backend is unavailable.
    });
}

export function deleteMultipleRecord(multipleId: string) {
  fetch(buildApiUrl(`/storage/multiples/${multipleId}`), {
    method: "DELETE",
  }).catch(() => {
    // Keep local delete path non-blocking if backend is unavailable.
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
      const outbound = buildOutboundSnapshot();
      setSnapshotMetadata(outbound.metadata);
      const result = await persistSnapshotToServer(outbound);

      if (result.ignored_due_to_staleness) {
        applyStorageSnapshot(result.snapshot);
      }
    } catch {
      // Keep local cache usable even if backend sync is unavailable.
    } finally {
      persistInFlight = false;
      queuedPersistTimeout = null;
    }
  }, 350);
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
      setEntityMetadata(entityKey, outbound.metadata);
      const result = await persistEntityToServer(entityKey, outbound);

      if (result.ignored_due_to_staleness) {
        applyEntityState(entityKey, result.entity);
      }
    } catch {
      // Keep local cache usable even if backend sync is unavailable.
    } finally {
      entitySyncInFlight.delete(entityKey);
      queuedEntityTimeouts.delete(entityKey);
    }
  }, 250);

  queuedEntityTimeouts.set(entityKey, nextTimeout);
  queueStorageSnapshotSync();
}

async function hydrateEntitiesFromServer() {
  const response = await fetch(buildApiUrl("/storage/entities"));
  if (!response.ok) {
    throw new Error(`Failed to hydrate entity storage (${response.status})`);
  }

  const data = (await response.json()) as {
    entities: Record<EntityKey, EntityStatePayload>;
  };

  const remoteEntities = data.entities;
  const entityKeys = Object.keys(ENTITY_CONFIG) as EntityKey[];
  let anyRemoteApplied = false;
  let anyLocalPushed = false;

  for (const entityKey of entityKeys) {
    const remoteEntity = remoteEntities[entityKey];
    const localEntity = getLocalEntityState(entityKey);

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
      setEntityMetadata(entityKey, outbound.metadata);
      const result = await persistEntityToServer(entityKey, outbound);

      if (result.ignored_due_to_staleness) {
        applyEntityState(entityKey, result.entity);
        anyRemoteApplied = true;
      } else {
        anyLocalPushed = true;
      }
    }
  }

  if (anyRemoteApplied) return { hydrated: true, source: "remote-entities" as const };
  if (anyLocalPushed) return { hydrated: true, source: "local-entities-pushed" as const };
  return { hydrated: true, source: "empty-entities" as const };
}

export async function hydrateStorageFromServer() {
  try {
    return await hydrateEntitiesFromServer();
  } catch {
    try {
      const response = await fetch(buildApiUrl("/storage/snapshot"));
      if (!response.ok) {
        throw new Error(`Failed to hydrate storage (${response.status})`);
      }

      const data = (await response.json()) as { snapshot: StorageSnapshotPayload };
      const remoteSnapshot = data.snapshot;
      const localSnapshot = getLocalStorageSnapshot();

      if (
        snapshotHasMeaningfulData(remoteSnapshot) &&
        getSnapshotUpdatedAt(remoteSnapshot) >= getSnapshotUpdatedAt(localSnapshot)
      ) {
        applyStorageSnapshot(remoteSnapshot);
        return { hydrated: true, source: "remote-snapshot" as const };
      }

      if (snapshotHasMeaningfulData(localSnapshot)) {
        const outbound = buildOutboundSnapshot();
        setSnapshotMetadata(outbound.metadata);
        const result = await persistSnapshotToServer(outbound);
        if (result.ignored_due_to_staleness) {
          applyStorageSnapshot(result.snapshot);
          return { hydrated: true, source: "remote-snapshot-won" as const };
        }
        return { hydrated: true, source: "local-snapshot-pushed" as const };
      }

      return { hydrated: true, source: "empty" as const };
    } catch {
      return { hydrated: false, source: "offline" as const };
    }
  }
}

export { PERSISTENCE_HYDRATED_EVENT };
