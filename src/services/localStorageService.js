import { DEFAULT_APP_STATE, DEFAULT_APP_SETTINGS, STORAGE_KEYS } from '../constants/defaults';
import { normalizeNodeData } from '../utils/nodeFactory';

export function loadAppMeta() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.APP_DATA_META);
    if (!raw) {
      return { hash: null, exportedAt: null };
    }
    const parsed = JSON.parse(raw);
    return {
      hash: parsed.hash || null,
      exportedAt: parsed.exportedAt || null
    };
  } catch (error) {
    console.warn('Failed to load app meta from localStorage:', error);
    return { hash: null, exportedAt: null };
  }
}

export function saveAppMeta(meta) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.APP_DATA_META, JSON.stringify(meta));
  } catch (error) {
    console.warn('Failed to save app meta to localStorage:', error);
  }
}

/**
 * Returns the exact subset of state we persist (and therefore export/import).
 * Keep this in sync with saveAppData().
 */
export function getPersistedSnapshot(appState) {
  return {
    nodes: appState.nodes,
    edges: appState.edges,
    viewport: appState.viewport,
    appSettings: appState.appSettings
  };
}

export function loadAppData() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.APP_DATA);
    if (!raw) {
      return DEFAULT_APP_STATE;
    }

    const parsed = JSON.parse(raw);
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
      }
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
      appSettings: appState.appSettings
    };
    window.localStorage.setItem(STORAGE_KEYS.APP_DATA, JSON.stringify(persistedState));
  } catch (error) {
    console.error('Failed to save app data to localStorage:', error);
  }
}
