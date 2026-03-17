import { DEFAULT_APP_STATE, DEFAULT_APP_SETTINGS } from '../constants/defaults';
import { normalizeNodeData } from '../utils/nodeFactory';
import { normalizeSavedPeopleCollection } from '../utils/family3Schema';
import { hashObject } from '../utils/stableHash';

export const LOCAL_CONFIG_PATH = '/data/familytree.config.json';
export const LOCAL_SAVED_PEOPLE_PATH = '/data/savedPeople.json';
export const LOCAL_STATE_PATH = '/data/family-tree-state.json';
export const LOCAL_SAVE_ROUTE = '/__local-state/save';

function unwrapSnapshot(json) {
  if (!json || typeof json !== 'object') {
    return null;
  }

  const hasWrapper = json.data && typeof json.data === 'object';

  return {
    snapshot: hasWrapper ? json.data : json,
    meta: hasWrapper ? (json.meta || {}) : {}
  };
}

export function parseRemoteSnapshot(configJson, peopleJson = null) {
  const configUnwrapped = unwrapSnapshot(configJson);
  if (!configUnwrapped) {
    return null;
  }

  const configSnapshot = configUnwrapped.snapshot || {};
  const peopleUnwrapped = peopleJson ? unwrapSnapshot(peopleJson) : null;

  const legacySavedPeople = configSnapshot.savedPeople || [];
  const splitSavedPeople = peopleUnwrapped?.snapshot?.savedPeople || [];
  const savedPeopleSource = splitSavedPeople.length ? splitSavedPeople : legacySavedPeople;

  const nodes = (configSnapshot.nodes || DEFAULT_APP_STATE.nodes).map((node) => ({
    ...node,
    data: normalizeNodeData(node.data || {})
  }));

  const hydrated = {
    nodes,
    edges: configSnapshot.edges || DEFAULT_APP_STATE.edges,
    viewport: configSnapshot.viewport || DEFAULT_APP_STATE.viewport,
    appSettings: {
      ...DEFAULT_APP_SETTINGS,
      ...(configSnapshot.appSettings || {})
    },
    savedPeople: normalizeSavedPeopleCollection(savedPeopleSource)
  };

  const computedHash = hashObject(hydrated);
  const meta = {
    ...configUnwrapped.meta,
    ...(peopleUnwrapped?.meta || {})
  };

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

function buildCacheBustedUrl(remoteUrl) {
  return remoteUrl.includes('?')
    ? `${remoteUrl}&cb=${Date.now()}`
    : `${remoteUrl}?cb=${Date.now()}`;
}

export async function fetchRemoteSnapshot(configUrl = LOCAL_CONFIG_PATH, peopleUrl = LOCAL_SAVED_PEOPLE_PATH) {
  try {
    const [configRes, peopleRes] = await Promise.all([
      fetch(buildCacheBustedUrl(configUrl), { cache: 'no-store' }),
      fetch(buildCacheBustedUrl(peopleUrl), { cache: 'no-store' })
    ]);

    if (!configRes.ok) {
      if (configRes.status === 404) {
        const legacyRes = await fetch(buildCacheBustedUrl(LOCAL_STATE_PATH), { cache: 'no-store' });
        const legacyJson = await parseJsonResponse(legacyRes);
        const parsedLegacy = parseRemoteSnapshot(legacyJson, null);
        if (!parsedLegacy) {
          return { ok: false, error: 'Legacy state JSON was not in a supported format.' };
        }
        return { ok: true, ...parsedLegacy };
      }
      throw new Error(`Config fetch failed (${configRes.status})`);
    }

    const configJson = await parseJsonResponse(configRes);
    let peopleJson = null;

    if (peopleRes.ok) {
      peopleJson = await parseJsonResponse(peopleRes);
    } else if (peopleRes.status !== 404) {
      throw new Error(`Saved people fetch failed (${peopleRes.status})`);
    }

    const parsed = parseRemoteSnapshot(configJson, peopleJson);
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
