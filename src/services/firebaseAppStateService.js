import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { normalizeNodeData } from '../utils/nodeFactory';
import { normalizeSavedPeopleCollection } from '../utils/family3Schema';
import { DEFAULT_APP_SETTINGS, DEFAULT_APP_STATE } from '../constants/defaults';
import { buildFamilyScopedCollectionName, FAMILY_SLUG } from '../config/familyConfig';
import { hashObject } from '../utils/stableHash';
import { requireAdminSession } from './authService';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const DEFAULT_FIREBASE_APP_STATE_COLLECTION = 'FamilyTree_App_State';
export const LEGACY_FIREBASE_APP_STATE_COLLECTION = DEFAULT_FIREBASE_APP_STATE_COLLECTION;
export const DEFAULT_FIREBASE_CONFIG_DOC = 'familytree.config';
export const DEFAULT_FIREBASE_SAVED_PEOPLE_DOC = 'familyTreeAppSavedPeople';
export const DEFAULT_FIREBASE_LEGACY_STATE_DOC = 'family-tree-state';

const appStateCollectionName = import.meta.env.VITE_FIREBASE_APP_STATE_COLLECTION || buildFamilyScopedCollectionName(DEFAULT_FIREBASE_APP_STATE_COLLECTION, FAMILY_SLUG);
const legacyAppStateCollectionName = import.meta.env.VITE_FIREBASE_APP_STATE_LEGACY_COLLECTION || LEGACY_FIREBASE_APP_STATE_COLLECTION;
const configDocumentName = import.meta.env.VITE_FIREBASE_APP_STATE_CONFIG_DOC || DEFAULT_FIREBASE_CONFIG_DOC;
const savedPeopleDocumentName = import.meta.env.VITE_FIREBASE_APP_STATE_SAVED_PEOPLE_DOC || DEFAULT_FIREBASE_SAVED_PEOPLE_DOC;
const legacyStateDocumentName = import.meta.env.VITE_FIREBASE_APP_STATE_LEGACY_DOC || DEFAULT_FIREBASE_LEGACY_STATE_DOC;

function hasValue(value) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

export function isFirebaseAppStateConfigured() {
  return Object.values(firebaseConfig).every(hasValue)
    && hasValue(appStateCollectionName)
    && hasValue(configDocumentName)
    && hasValue(savedPeopleDocumentName)
    && hasValue(legacyStateDocumentName);
}

function getDb() {
  if (!isFirebaseAppStateConfigured()) {
    throw new Error('Firebase app-state sync is not configured. Add the VITE_FIREBASE_* environment variables.');
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}

function createEnvelope(meta, data) {
  return {
    meta,
    data,
    updatedAt: serverTimestamp()
  };
}

function unwrapEnvelope(documentSnapshot) {
  if (!documentSnapshot?.exists()) {
    return null;
  }

  const raw = documentSnapshot.data() || {};
  if (raw && typeof raw === 'object' && raw.data && raw.meta) {
    return {
      meta: raw.meta || {},
      data: raw.data,
      updatedAt: raw.updatedAt || null
    };
  }

  return {
    meta: raw.meta || {},
    data: raw,
    updatedAt: raw.updatedAt || null
  };
}

function parseFirebaseSnapshot(configEnvelope, peopleEnvelope) {
  if (!configEnvelope?.data) {
    return null;
  }

  const configData = configEnvelope.data || {};
  const peopleData = peopleEnvelope?.data || {};
  const legacyData = configData?.savedPeople ? configData : null;

  const nodesSource = legacyData?.nodes || configData.nodes || DEFAULT_APP_STATE.nodes;
  const edgesSource = legacyData?.edges || configData.edges || DEFAULT_APP_STATE.edges;
  const viewportSource = legacyData?.viewport || configData.viewport || DEFAULT_APP_STATE.viewport;
  const settingsSource = legacyData?.appSettings || configData.appSettings || DEFAULT_APP_SETTINGS;
  const savedPeopleSource = legacyData?.savedPeople || peopleData.savedPeople || [];

  const snapshot = {
    nodes: nodesSource.map((node) => ({
      ...node,
      data: normalizeNodeData(node.data || {})
    })),
    edges: edgesSource,
    viewport: viewportSource,
    appSettings: {
      ...DEFAULT_APP_SETTINGS,
      ...(settingsSource || {})
    },
    savedPeople: normalizeSavedPeopleCollection(savedPeopleSource)
  };

  const configMeta = configEnvelope.meta || {};
  const peopleMeta = peopleEnvelope?.meta || {};
  const computedHash = hashObject(snapshot);

  return {
    snapshot,
    meta: {
      hash: configMeta.hash || peopleMeta.hash || computedHash,
      computedHash,
      exportedAt: configMeta.exportedAt || peopleMeta.exportedAt || null,
      appVersion: configMeta.appVersion || peopleMeta.appVersion || null,
      updatedAt: configEnvelope.updatedAt || peopleEnvelope?.updatedAt || null
    }
  };
}

function buildPersistPayload(snapshot, meta = {}) {
  const hash = meta.hash || hashObject(snapshot);
  const exportedAt = meta.exportedAt || new Date().toISOString();
  const appVersion = meta.appVersion || null;

  return {
    hash,
    exportedAt,
    configPayload: {
      meta: {
        hash,
        exportedAt,
        appVersion
      },
      data: {
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        viewport: snapshot.viewport,
        appSettings: snapshot.appSettings
      }
    },
    savedPeoplePayload: {
      meta: {
        hash,
        exportedAt,
        appVersion
      },
      data: {
        savedPeople: snapshot.savedPeople
      }
    },
    legacyCombinedPayload: {
      meta: {
        hash,
        exportedAt,
        appVersion
      },
      data: snapshot
    }
  };
}

export function getFirebaseAppStateCollectionName() {
  return appStateCollectionName;
}

export function getLegacyFirebaseAppStateCollectionName() {
  return legacyAppStateCollectionName;
}

export function getFirebaseAppStateDocumentNames() {
  return {
    config: configDocumentName,
    savedPeople: savedPeopleDocumentName,
    legacyState: legacyStateDocumentName
  };
}

export async function migrateLocalSnapshotToFirebase(payload) {
  requireAdminSession();
  if (!payload || typeof payload !== 'object') {
    throw new Error('Missing migration payload.');
  }

  const configPayload = payload.configPayload;
  const savedPeoplePayload = payload.savedPeoplePayload;
  const legacyCombinedPayload = payload.legacyCombinedPayload;

  if (!configPayload?.meta || !configPayload?.data) {
    throw new Error('Missing config payload for migration.');
  }

  if (!savedPeoplePayload?.meta || !savedPeoplePayload?.data) {
    throw new Error('Missing saved people payload for migration.');
  }

  if (!legacyCombinedPayload?.meta || !legacyCombinedPayload?.data) {
    throw new Error('Missing legacy state payload for migration.');
  }

  const db = getDb();
  const batch = writeBatch(db);
  const stateCollection = collection(db, appStateCollectionName);

  batch.set(doc(stateCollection, configDocumentName), createEnvelope(configPayload.meta, configPayload.data));
  batch.set(doc(stateCollection, savedPeopleDocumentName), createEnvelope(savedPeoplePayload.meta, savedPeoplePayload.data));
  batch.set(doc(stateCollection, legacyStateDocumentName), createEnvelope(legacyCombinedPayload.meta, legacyCombinedPayload.data));

  await batch.commit();

  return {
    ok: true,
    collectionName: appStateCollectionName,
    documentNames: getFirebaseAppStateDocumentNames()
  };
}


async function fetchSnapshotFromCollection(db, collectionName) {
  const stateCollection = collection(db, collectionName);

  const [configSnapshot, peopleSnapshot, legacySnapshot] = await Promise.all([
    getDoc(doc(stateCollection, configDocumentName)),
    getDoc(doc(stateCollection, savedPeopleDocumentName)),
    getDoc(doc(stateCollection, legacyStateDocumentName))
  ]);

  const configEnvelope = unwrapEnvelope(configSnapshot);
  const peopleEnvelope = unwrapEnvelope(peopleSnapshot);
  const legacyEnvelope = unwrapEnvelope(legacySnapshot);
  const parsed = parseFirebaseSnapshot(configEnvelope || legacyEnvelope, peopleEnvelope);

  return parsed ? { ok: true, ...parsed, collectionName } : { ok: false, error: 'Firebase app state was not in a supported format.', collectionName };
}

export async function fetchFirebaseAppStateSnapshot() {
  const db = getDb();
  const primaryResult = await fetchSnapshotFromCollection(db, appStateCollectionName);
  if (primaryResult.ok) {
    return primaryResult;
  }

  if (legacyAppStateCollectionName && legacyAppStateCollectionName !== appStateCollectionName) {
    const legacyResult = await fetchSnapshotFromCollection(db, legacyAppStateCollectionName);
    if (legacyResult.ok) {
      return { ...legacyResult, source: 'legacy-fallback' };
    }
  }

  return primaryResult;
}

export async function saveFirebaseAppStateSnapshot(snapshot, meta = {}) {
  requireAdminSession();
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Missing app snapshot.');
  }

  const payload = buildPersistPayload(snapshot, meta);
  await migrateLocalSnapshotToFirebase(payload);

  return {
    ok: true,
    hash: payload.hash,
    exportedAt: payload.exportedAt,
    collectionName: appStateCollectionName,
    documentNames: getFirebaseAppStateDocumentNames()
  };
}

export async function readFirebaseAppStateDocuments() {
  requireAdminSession();
  const db = getDb();
  const snapshot = await getDocs(collection(db, appStateCollectionName));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}
