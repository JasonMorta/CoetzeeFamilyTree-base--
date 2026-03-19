import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { requireAdminSession } from './authService';
import { buildFamilyScopedCollectionName, FAMILY_SLUG } from '../config/familyConfig';
import { createStandardPersonWrapper, standardPersonToSavedRecord } from '../utils/family3Schema';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const DEFAULT_FIREBASE_UPDATE_REQUESTS_COLLECTION = 'FamilyTree_Update_Requests';
const collectionName = import.meta.env.VITE_FIREBASE_UPDATE_REQUESTS_COLLECTION || buildFamilyScopedCollectionName(DEFAULT_FIREBASE_UPDATE_REQUESTS_COLLECTION, FAMILY_SLUG);

function hasValue(value) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function getDb() {
  if (!Object.values(firebaseConfig).every(hasValue) || !hasValue(collectionName)) {
    throw new Error('Firebase update requests are not configured. Add the VITE_FIREBASE_* environment variables.');
  }
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}

function normalizeRecord(docSnap) {
  const raw = docSnap.data() || {};
  return {
    requestId: docSnap.id,
    status: raw.status || 'pending',
    requestType: raw.requestType || 'person_update',
    familySlug: raw.familySlug || FAMILY_SLUG,
    familyDisplayName: raw.familyDisplayName || '',
    targetPersonId: String(raw.targetPersonId || '').trim(),
    targetPersonName: String(raw.targetPersonName || raw.proposedRecord?.person?.name || '').trim(),
    submittedAt: raw.submittedAt || raw.createdAt || '',
    updatedAt: raw.updatedAt || '',
    originalRecord: raw.originalRecord ? standardPersonToSavedRecord(createStandardPersonWrapper(raw.originalRecord)) : null,
    proposedRecord: raw.proposedRecord ? standardPersonToSavedRecord(createStandardPersonWrapper(raw.proposedRecord)) : null,
    summary: raw.summary || ''
  };
}

export function getFirebaseUpdateRequestsCollectionName() {
  return collectionName;
}

export async function fetchFirebaseUpdateRequests() {
  requireAdminSession();
  const db = getDb();
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs
    .map(normalizeRecord)
    .sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));
}

export async function fetchPendingUpdateRequestCount() {
  requireAdminSession();
  const all = await fetchFirebaseUpdateRequests();
  return all.filter((item) => item.status === 'pending').length;
}

export async function deleteFirebaseUpdateRequest(requestId) {
  requireAdminSession();
  if (!requestId) throw new Error('Missing update request ID.');
  const db = getDb();
  await deleteDoc(doc(db, collectionName, requestId));
}

export async function updateFirebaseUpdateRequest(requestId, payload = {}) {
  requireAdminSession();
  if (!requestId) throw new Error('Missing update request ID.');
  const db = getDb();
  const docRef = doc(db, collectionName, requestId);
  const existing = await getDoc(docRef);
  if (!existing.exists()) throw new Error('This update request could not be found.');
  await setDoc(docRef, { ...existing.data(), ...payload, updatedAt: serverTimestamp() }, { merge: false });
}
