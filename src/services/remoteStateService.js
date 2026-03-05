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

function isGoogleDriveLikeUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname === 'drive.google.com' || url.hostname === 'docs.googleusercontent.com';
  } catch {
    return false;
  }
}

function buildProxyUrl(remoteUrl) {
  const params = new URLSearchParams({
    url: remoteUrl,
    cb: String(Date.now())
  });
  return `/.netlify/functions/remoteStateProxy?${params.toString()}`;
}

async function parseJsonResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Remote fetch failed (${res.status})`);
  }

  // Helpful guard so HTML error pages do not silently blow up as JSON parse errors.
  if (!contentType.includes('application/json') && text.trim().startsWith('<')) {
    throw new Error('Remote response was HTML instead of JSON.');
  }

  return JSON.parse(text);
}

export async function fetchRemoteSnapshot(remoteUrl) {
  if (!remoteUrl) {
    return { ok: false, error: 'Missing remote URL.' };
  }

  try {
    let json;

    if (isGoogleDriveLikeUrl(remoteUrl)) {
      // IMPORTANT:
      // Do NOT hit Google Drive directly from the browser.
      // Even publicly shared files often return 403 / CORS failures for JS fetch requests.
      // Route Drive reads through the Netlify Function proxy only.
      const proxiedUrl = buildProxyUrl(remoteUrl);
      const res = await fetch(proxiedUrl, { cache: 'no-store' });
      json = await parseJsonResponse(res);
    } else {
      // Non-Drive URLs can still try a direct browser fetch first.
      const cacheBustedUrl = remoteUrl.includes('?')
        ? `${remoteUrl}&cb=${Date.now()}`
        : `${remoteUrl}?cb=${Date.now()}`;

      let res;
      try {
        res = await fetch(cacheBustedUrl, { cache: 'no-store' });
      } catch {
        res = null;
      }

      if (!res) {
        const proxiedUrl = buildProxyUrl(cacheBustedUrl);
        res = await fetch(proxiedUrl, { cache: 'no-store' });
      }

      json = await parseJsonResponse(res);
    }

    const parsed = parseRemoteSnapshot(json);
    if (!parsed) {
      return { ok: false, error: 'Remote JSON was not in a supported format.' };
    }

    return { ok: true, ...parsed };
  } catch (error) {
    console.error('Remote fetch error:', error);
    return { ok: false, error: error?.message || 'Remote fetch error (see console).' };
  }
}
