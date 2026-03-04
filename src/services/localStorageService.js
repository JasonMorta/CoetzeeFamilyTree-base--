import { DEFAULT_APP_STATE, DEFAULT_APP_SETTINGS, STORAGE_KEYS } from '../constants/defaults';
import { normalizeNodeData } from '../utils/nodeFactory';

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
