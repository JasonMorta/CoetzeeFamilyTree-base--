import { DEFAULT_APP_STATE, DEFAULT_APP_SETTINGS } from '../constants/defaults';
import { normalizeNodeData } from '../utils/nodeFactory';
import { hashObject } from '../utils/stableHash';

/**
 * Expected JSON format:
 * {
 *   "meta": { "hash": "....", "exportedAt": "ISO", "appVersion": "x.y.z" },
 *   "data": { "nodes": [], "edges": [], "viewport": {}, "appSettings": {} }
 * }
 *
 * We allow both:
 * - the above wrapper format, OR
 * - a raw persisted snapshot directly (nodes/edges/viewport/appSettings).
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
    }
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

export async function fetchRemoteSnapshot(remoteUrl) {
  if (!remoteUrl) {
    return { ok: false, error: 'Missing remote URL.' };
  }

  try {
    // Cache-bust so Drive/CDN returns the latest JSON.
    const cacheBustedUrl = remoteUrl.includes('?')
      ? `${remoteUrl}&cb=${Date.now()}`
      : `${remoteUrl}?cb=${Date.now()}`;

    const res = await fetch(cacheBustedUrl, { cache: 'no-store' });
    if (!res.ok) {
      return { ok: false, error: `Remote fetch failed (${res.status})` };
    }

    const json = await res.json();
    const parsed = parseRemoteSnapshot(json);
    if (!parsed) {
      return { ok: false, error: 'Remote JSON was not in a supported format.' };
    }

    return { ok: true, ...parsed };
  } catch (error) {
    console.error('Remote fetch error:', error);
    return { ok: false, error: 'Remote fetch error (see console).' };
  }
}
