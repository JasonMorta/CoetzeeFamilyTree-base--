import { DEFAULT_APP_STATE, DEFAULT_APP_SETTINGS } from '../constants/defaults';
import { normalizeNodeData } from '../utils/nodeFactory';
import { hashObject } from '../utils/stableHash';

export const LOCAL_STATE_PATH = '/data/family-tree-state.json';
export const LOCAL_SAVE_ROUTE = '/__local-state/save';

/**
 * Expected JSON format:
 * {
 *   "meta": { "hash": "....", "exportedAt": "ISO", "appVersion": "x.y.z" },
 *   "data": { "nodes": [], "edges": [], "viewport": {}, "appSettings": {}, "savedPeople": [] }
 * }
 *
 * We allow both:
 * - the above wrapper format, OR
 * - a raw persisted snapshot directly (nodes/edges/viewport/appSettings/savedPeople).
 */
export function parseRemoteSnapshot(json) {
  if (!json || typeof json !== 'object') {
    return null;
  }

  const hasWrapper = json.data && typeof json.data === 'object';
  const snapshot = hasWrapper ? json.data : json;

  const nodes = (snapshot.nodes || DEFAULT_APP_STATE.nodes).map((node) => ({
    ...node,
    data: normalizeNodeData(node.data || {})
  }));

  const hydrated = {
    nodes,
    edges: snapshot.edges || DEFAULT_APP_STATE.edges,
    viewport: snapshot.viewport || DEFAULT_APP_STATE.viewport,
    appSettings: {
      ...DEFAULT_APP_SETTINGS,
      ...(snapshot.appSettings || {})
    },
    savedPeople: Array.isArray(snapshot.savedPeople) ? snapshot.savedPeople : []
  };

  const computedHash = hashObject(hydrated);
  const meta = hasWrapper ? (json.meta || {}) : {};

  return {
    snapshot: hydrated,
    meta: {
      hash: meta.hash || computedHash,
      exportedAt: meta.exportedAt || null,
      appVersion: meta.appVersion || null,
      computedHash
    }
  };
}

async function parseJsonResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`State fetch failed (${res.status})`);
  }

  if (!contentType.includes('application/json') && text.trim().startsWith('<')) {
    throw new Error('State response was HTML instead of JSON.');
  }

  return JSON.parse(text);
}

export async function fetchRemoteSnapshot(remoteUrl = LOCAL_STATE_PATH) {
  try {
    const cacheBustedUrl = remoteUrl.includes('?')
      ? `${remoteUrl}&cb=${Date.now()}`
      : `${remoteUrl}?cb=${Date.now()}`;

    const res = await fetch(cacheBustedUrl, { cache: 'no-store' });
    const json = await parseJsonResponse(res);

    const parsed = parseRemoteSnapshot(json);
    if (!parsed) {
      return { ok: false, error: 'State JSON was not in a supported format.' };
    }

    return { ok: true, ...parsed };
  } catch (error) {
    console.error('State fetch error:', error);
    return { ok: false, error: error?.message || 'State fetch error (see console).' };
  }
}

export async function saveLocalSnapshot(payload) {
  try {
    const res = await fetch(LOCAL_SAVE_ROUTE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const json = await parseJsonResponse(res);
    return json?.ok ? { ok: true } : { ok: false, error: json?.error || 'Local save failed.' };
  } catch (error) {
    return { ok: false, error: error?.message || 'Local save failed.' };
  }
}
