import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { normalizeSavedPersonRecord, savedPersonToFirebasePayload } from '../utils/family3Schema';
import { requireAdminSession } from './authService';
import { buildFamilyScopedCollectionName, FAMILY_SLUG } from '../config/familyConfig';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const DEFAULT_FIREBASE_PEOPLE_COLLECTION = 'Family3_Form_Submissions';
export const LEGACY_FIREBASE_PEOPLE_COLLECTION = DEFAULT_FIREBASE_PEOPLE_COLLECTION;

const collectionName = import.meta.env.VITE_FIREBASE_PEOPLE_COLLECTION || buildFamilyScopedCollectionName(DEFAULT_FIREBASE_PEOPLE_COLLECTION, FAMILY_SLUG);
const legacyCollectionName = import.meta.env.VITE_FIREBASE_PEOPLE_LEGACY_COLLECTION || LEGACY_FIREBASE_PEOPLE_COLLECTION;

function hasValue(value) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

export function isFirebasePeopleConfigured() {
  return Object.values(firebaseConfig).every(hasValue) && hasValue(collectionName);
}

function getDb() {
  if (!isFirebasePeopleConfigured()) {
    throw new Error('Firebase people list is not configured. Add the VITE_FIREBASE_* environment variables.');
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}

function mapFirebaseDoc(snapshot) {
  const raw = snapshot.data() || {};
  const normalized = normalizeSavedPersonRecord({
    ...raw,
    firebaseDocumentId: snapshot.id
  });

  return {
    ...normalized,
    firebaseDocumentId: snapshot.id
  };
}

async function fetchCollectionDocs(db, targetCollectionName) {
  const snapshot = await getDocs(collection(db, targetCollectionName));
  const items = snapshot.docs.map(mapFirebaseDoc);
  items.sort((a, b) => {
    const nameA = String(a?.person?.name || '').toLowerCase();
    const nameB = String(b?.person?.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
  return items;
}

export async function fetchFirebasePeopleList() {
  requireAdminSession();
  const db = getDb();
  const items = await fetchCollectionDocs(db, collectionName);
  if (items.length > 0 || !legacyCollectionName || legacyCollectionName === collectionName) {
    return items;
  }
  return fetchCollectionDocs(db, legacyCollectionName);
}

export async function updateFirebasePersonRecord(documentId, record) {
  requireAdminSession();
  if (!documentId) {
    throw new Error('Missing Firebase document ID for update.');
  }

  const db = getDb();
  await updateDoc(doc(db, collectionName, documentId), savedPersonToFirebasePayload(record));
}

export function getFirebasePeopleCollectionName() {
  return collectionName;
}

export function getLegacyFirebasePeopleCollectionName() {
  return legacyCollectionName;
}

export async function deleteFirebasePersonRecord(documentId) {
  requireAdminSession();
  if (!documentId) {
    throw new Error('Missing Firebase document ID for delete.');
  }

  const db = getDb();
  await deleteDoc(doc(db, collectionName, documentId));
}


export async function syncLegacyPeopleCollectionToFamilyScope() {
  requireAdminSession();
  const db = getDb();
  if (!legacyCollectionName || legacyCollectionName === collectionName) {
    return { ok: true, copiedCount: 0, collectionName, sourceCollectionName: legacyCollectionName || collectionName };
  }

  const legacySnapshot = await getDocs(collection(db, legacyCollectionName));
  const batch = writeBatch(db);
  legacySnapshot.docs.forEach((item) => {
    batch.set(doc(db, collectionName, item.id), item.data());
  });
  await batch.commit();

  return {
    ok: true,
    copiedCount: legacySnapshot.size,
    collectionName,
    sourceCollectionName: legacyCollectionName
  };
}
