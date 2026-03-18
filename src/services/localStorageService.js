import { idbSet, idbGet } from './indexedDbService';
import { DEFAULT_APP_STATE, DEFAULT_APP_SETTINGS, STORAGE_KEYS } from '../constants/defaults';
import { normalizeNodeData } from '../utils/nodeFactory';
import { normalizeSavedPeopleCollection } from '../utils/family3Schema';

export const REMOTE_FETCH_MIN_INTERVAL_MS = 60_000;
export const APP_CACHE_MAX_AGE_MS = 60 * 60 * 1000;

function createEmptyMeta() {
  return {
    hash: null,
    exportedAt: null,
    lastRemoteFetchAt: null,
    nextRemoteFetchAllowedAt: null,
    cachedSnapshotAt: null
  };
}

function readPersistedAppDataRaw() {
  return window.sessionStorage.getItem(STORAGE_KEYS.APP_DATA) || window.localStorage.getItem(STORAGE_KEYS.APP_DATA);
}

function parsePersistedAppData() {
  const raw = readPersistedAppDataRaw();
  if (!raw) {
    return null;
  }

  return JSON.parse(raw);
}

function hasObjectShape(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isValidPersistedAppData(value) {
  return Boolean(value)
    && Array.isArray(value.nodes)
    && Array.isArray(value.edges)
    && Array.isArray(value.savedPeople || [])
    && hasObjectShape(value.viewport)
    && hasObjectShape(value.appSettings || {});
}

export function getPersistedAppDataStatus() {
  try {
    const parsed = parsePersistedAppData();
    const meta = loadAppMeta();
    const isValid = isValidPersistedAppData(parsed);
    const cachedAt = meta.cachedSnapshotAt || meta.lastRemoteFetchAt || null;
    const ageMs = cachedAt ? Math.max(0, Date.now() - cachedAt) : null;
    const isFresh = Boolean(isValid && cachedAt && ageMs !== null && ageMs <= APP_CACHE_MAX_AGE_MS);
    return {
      exists: Boolean(parsed),
      isValid,
      isFresh,
      cachedAt,
      ageMs,
      meta
    };
  } catch (error) {
    console.warn('Failed to inspect persisted app data:', error);
    return {
      exists: false,
      isValid: false,
      isFresh: false,
      cachedAt: null,
      ageMs: null,
      meta: createEmptyMeta()
    };
  }
}

export function loadAppMeta() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.APP_DATA_META);
    if (!raw) {
      return createEmptyMeta();
    }
    const parsed = JSON.parse(raw);
    return {
      hash: parsed.hash || null,
      exportedAt: parsed.exportedAt || null,
      lastRemoteFetchAt: parsed.lastRemoteFetchAt ? Number(parsed.lastRemoteFetchAt) || null : null,
      nextRemoteFetchAllowedAt: parsed.nextRemoteFetchAllowedAt ? Number(parsed.nextRemoteFetchAllowedAt) || null : null,
      cachedSnapshotAt: parsed.cachedSnapshotAt ? Number(parsed.cachedSnapshotAt) || null : null
    };
  } catch (error) {
    console.warn('Failed to load app meta from localStorage:', error);
    return createEmptyMeta();
  }
}

export function saveAppMeta(meta) {
  try {
    const currentMeta = loadAppMeta();
    window.localStorage.setItem(STORAGE_KEYS.APP_DATA_META, JSON.stringify({ ...currentMeta, ...meta }));
  } catch (error) {
    console.warn('Failed to save app meta to localStorage:', error);
  }
}

export function getPersistedSnapshot(appState) {
  return {
    nodes: appState.nodes,
    edges: appState.edges,
    viewport: appState.viewport,
    appSettings: appState.appSettings,
    savedPeople: normalizeSavedPeopleCollection(appState.savedPeople || [])
  };
}

export function loadAppData() {
  try {
    const parsed = parsePersistedAppData();
    if (!parsed || !isValidPersistedAppData(parsed)) {
      return DEFAULT_APP_STATE;
    }
    const savedPeople = normalizeSavedPeopleCollection(parsed.savedPeople || []);
    const nodes = (parsed.nodes || DEFAULT_APP_STATE.nodes).map((node) => ({
      ...node,
      data: normalizeNodeData(node.data || {})
    }));

    return {
      ...DEFAULT_APP_STATE,
      ...parsed,
      nodes,
      appSettings: {
        ...DEFAULT_APP_SETTINGS,
        ...(parsed.appSettings || {})
      },
      savedPeople
    };
  } catch (error) {
    console.error('Failed to load app data from localStorage:', error);
    return DEFAULT_APP_STATE;
  }
}

export function saveAppData(appState) {
  try {
    const persistedState = {
      nodes: appState.nodes,
      edges: appState.edges,
      viewport: appState.viewport,
      appSettings: appState.appSettings,
      savedPeople: normalizeSavedPeopleCollection(appState.savedPeople || [])
    };
    const cachedSnapshotAt = Date.now();
    window.localStorage.setItem(STORAGE_KEYS.APP_DATA, JSON.stringify(persistedState));
    window.sessionStorage.setItem(STORAGE_KEYS.APP_DATA, JSON.stringify(persistedState));
    saveAppMeta({
      cachedSnapshotAt,
      nextRemoteFetchAllowedAt: cachedSnapshotAt + REMOTE_FETCH_MIN_INTERVAL_MS
    });
    idbSet(STORAGE_KEYS.APP_DATA, persistedState).catch(() => {});
  } catch (error) {
    console.error('Failed to save app data to localStorage:', error);
  }
}

export async function loadAppDataFromIndexedDb() {
  try {
    const data = await idbGet(STORAGE_KEYS.APP_DATA);
    return data || null;
  } catch {
    return null;
  }
}

export function hasPersistedAppData() {
  try {
    return Boolean(readPersistedAppDataRaw());
  } catch {
    return false;
  }
}
