import { idbSet, idbGet } from './indexedDbService';
import { DEFAULT_APP_STATE, DEFAULT_APP_SETTINGS, STORAGE_KEYS } from '../constants/defaults';
import { normalizeNodeData } from '../utils/nodeFactory';
import { normalizeSavedPeopleCollection } from '../utils/family3Schema';

export function loadAppMeta() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.APP_DATA_META);
    if (!raw) {
      return { hash: null, exportedAt: null, lastRemoteFetchAt: null, nextRemoteFetchAllowedAt: null };
    }
    const parsed = JSON.parse(raw);
    return {
      hash: parsed.hash || null,
      exportedAt: parsed.exportedAt || null,
      lastRemoteFetchAt: parsed.lastRemoteFetchAt ? Number(parsed.lastRemoteFetchAt) || null : null,
      nextRemoteFetchAllowedAt: parsed.nextRemoteFetchAllowedAt ? Number(parsed.nextRemoteFetchAllowedAt) || null : null
    };
  } catch (error) {
    console.warn('Failed to load app meta from localStorage:', error);
    return { hash: null, exportedAt: null, lastRemoteFetchAt: null, nextRemoteFetchAllowedAt: null };
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
    const raw =
      window.sessionStorage.getItem(STORAGE_KEYS.APP_DATA) ||
      window.localStorage.getItem(STORAGE_KEYS.APP_DATA);
    if (!raw) {
      return DEFAULT_APP_STATE;
    }

    const parsed = JSON.parse(raw);
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
    window.localStorage.setItem(STORAGE_KEYS.APP_DATA, JSON.stringify(persistedState));
    window.sessionStorage.setItem(STORAGE_KEYS.APP_DATA, JSON.stringify(persistedState));
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
    return Boolean(window.sessionStorage.getItem(STORAGE_KEYS.APP_DATA) || window.localStorage.getItem(STORAGE_KEYS.APP_DATA));
  } catch {
    return false;
  }
}
