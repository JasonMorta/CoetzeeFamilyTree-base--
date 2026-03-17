import { useCallback, useEffect, useRef } from 'react';
import { ACTIONS } from '../context/appReducer';
import { fetchFirebaseAppStateSnapshot, isFirebaseAppStateConfigured } from '../services/firebaseAppStateService';
import { hasPersistedAppData, loadAppMeta, saveAppData, saveAppMeta } from '../services/localStorageService';

const AUTO_REFRESH_INTERVAL_MS = 120_000;
const NON_ADMIN_FETCH_COOLDOWN_MS = 60_000;

/**
 * Keeps clients in sync with the Firebase-backed app snapshot.
 *
 * - On load: fetch the latest Firebase snapshot before rendering the canvas.
 * - During idle viewing: poll every 2 minutes.
 * - For non-admin viewers, suppress repeated remote fetches for 1 minute across reloads and use the cached local snapshot instead.
 * - Re-apply state only when the remote snapshot hash changes.
 */
export function useRemoteStateSync(state, dispatch) {
  const inFlightRef = useRef(false);
  const latestHashRef = useRef(state.remoteSnapshotHash || state.lastExportHash || null);
  const hasInitialSyncCompletedRef = useRef(state.hasInitialRemoteSyncCompleted);

  useEffect(() => {
    latestHashRef.current = state.remoteSnapshotHash || state.lastExportHash || null;
  }, [state.remoteSnapshotHash, state.lastExportHash]);

  useEffect(() => {
    hasInitialSyncCompletedRef.current = state.hasInitialRemoteSyncCompleted;
  }, [state.hasInitialRemoteSyncCompleted]);

  const runSync = useCallback(async (reason = 'auto') => {
    if (inFlightRef.current) {
      return { ok: false, skipped: true, reason: 'Sync already in progress.' };
    }

    if (!isFirebaseAppStateConfigured()) {
      const error = 'Firebase app-state sync is not configured. Add the VITE_FIREBASE_* values to .env first.';
      dispatch({
        type: ACTIONS.REMOTE_SYNC_END,
        payload: { error, syncedAt: Date.now(), reason }
      });
      return { ok: false, error };
    }

    const isAdminRequest = Boolean(state.isAdminAuthenticated);
    const cacheMeta = loadAppMeta();
    const hasCachedSnapshot = hasPersistedAppData();
    const cooldownActive = !isAdminRequest
      && Boolean(cacheMeta.nextRemoteFetchAllowedAt)
      && Date.now() < cacheMeta.nextRemoteFetchAllowedAt;

    if (cooldownActive && hasCachedSnapshot) {
      dispatch({
        type: ACTIONS.REMOTE_SYNC_END,
        payload: { error: null, syncedAt: cacheMeta.lastRemoteFetchAt || Date.now(), reason: `${reason}-cache-hit` }
      });
      return { ok: true, skipped: true, usedCache: true };
    }

    inFlightRef.current = true;
    dispatch({ type: ACTIONS.REMOTE_SYNC_START, payload: { reason } });

    try {
      const result = await fetchFirebaseAppStateSnapshot();
      if (!result.ok) {
        dispatch({
          type: ACTIONS.REMOTE_SYNC_END,
          payload: { error: result.error, syncedAt: Date.now(), reason }
        });
        return result;
      }

      const remoteHash = result.meta.hash || result.meta.computedHash;
      const didChange = Boolean(remoteHash) && remoteHash !== latestHashRef.current;

      if (didChange || !hasInitialSyncCompletedRef.current) {
        dispatch({
          type: ACTIONS.APPLY_REMOTE_SNAPSHOT,
          payload: {
            ...result.snapshot,
            meta: result.meta
          }
        });
      } else {
        dispatch({
          type: ACTIONS.SET_REMOTE_SNAPSHOT_META,
          payload: result.meta
        });
      }

      latestHashRef.current = remoteHash;
      saveAppData(result.snapshot);

      const fetchedAt = Date.now();
      saveAppMeta({
        hash: remoteHash,
        exportedAt: result.meta.exportedAt || new Date().toISOString(),
        lastRemoteFetchAt: fetchedAt,
        nextRemoteFetchAllowedAt: isAdminRequest ? fetchedAt : fetchedAt + NON_ADMIN_FETCH_COOLDOWN_MS
      });

      dispatch({
        type: ACTIONS.REMOTE_SYNC_END,
        payload: { error: null, syncedAt: Date.now(), reason }
      });

      return { ok: true, changed: didChange };
    } catch (error) {
      const message = error?.message || 'Firebase sync failed.';
      dispatch({
        type: ACTIONS.REMOTE_SYNC_END,
        payload: { error: message, syncedAt: Date.now(), reason }
      });
      return { ok: false, error: message };
    } finally {
      inFlightRef.current = false;
    }
  }, [dispatch, state.isAdminAuthenticated]);

  useEffect(() => {
    void runSync('startup');
  }, [runSync]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void runSync('interval');
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [runSync]);

  return {
    runSync,
    autoRefreshIntervalMs: AUTO_REFRESH_INTERVAL_MS,
    nonAdminFetchCooldownMs: NON_ADMIN_FETCH_COOLDOWN_MS
  };
}
