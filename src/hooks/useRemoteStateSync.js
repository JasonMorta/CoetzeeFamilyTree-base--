import { useCallback, useEffect, useRef } from 'react';
import { ACTIONS } from '../context/appReducer';
import { fetchFirebaseAppStateSnapshot, isFirebaseAppStateConfigured } from '../services/firebaseAppStateService';
import {
  APP_CACHE_MAX_AGE_MS,
  REMOTE_FETCH_MIN_INTERVAL_MS,
  getPersistedAppDataStatus,
  loadAppMeta,
  saveAppData,
  saveAppMeta
} from '../services/localStorageService';

const AUTO_REFRESH_INTERVAL_MS = REMOTE_FETCH_MIN_INTERVAL_MS;

/**
 * Keeps clients in sync with the Firebase-backed app snapshot.
 *
 * Rules:
 * - Startup uses fresh local cache when it is valid and not older than 1 hour.
 * - If there is no fresh cache, fetch Firebase immediately.
 * - After startup, refresh from Firebase at most once per minute.
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

    const cacheMeta = loadAppMeta();
    const cacheStatus = getPersistedAppDataStatus();
    const now = Date.now();
    const cooldownUntil = cacheMeta.nextRemoteFetchAllowedAt || (cacheStatus.cachedAt ? cacheStatus.cachedAt + REMOTE_FETCH_MIN_INTERVAL_MS : null);
    const cooldownActive = Boolean(cooldownUntil) && now < cooldownUntil;
    const shouldPreferFreshCacheOnStartup = reason === 'startup' && cacheStatus.isFresh;

    if (shouldPreferFreshCacheOnStartup) {
      dispatch({
        type: ACTIONS.REMOTE_SYNC_END,
        payload: { error: null, syncedAt: cacheStatus.cachedAt || now, reason: 'startup-cache-hit' }
      });
      return {
        ok: true,
        skipped: true,
        usedCache: true,
        cacheAgeMs: cacheStatus.ageMs,
        cacheMaxAgeMs: APP_CACHE_MAX_AGE_MS
      };
    }

    if (cooldownActive && cacheStatus.isValid) {
      dispatch({
        type: ACTIONS.REMOTE_SYNC_END,
        payload: { error: null, syncedAt: cacheMeta.lastRemoteFetchAt || cacheStatus.cachedAt || now, reason: `${reason}-cache-hit` }
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
          payload: { error: result.error, syncedAt: now, reason }
        });
        return result;
      }

      const remoteHash = result.meta.hash || result.meta.computedHash;
      const didChange = Boolean(remoteHash) && remoteHash !== latestHashRef.current;

      if (didChange || !hasInitialSyncCompletedRef.current || !cacheStatus.isValid || !cacheStatus.isFresh) {
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
        exportedAt: result.meta.exportedAt || new Date(fetchedAt).toISOString(),
        lastRemoteFetchAt: fetchedAt,
        cachedSnapshotAt: fetchedAt,
        nextRemoteFetchAllowedAt: fetchedAt + REMOTE_FETCH_MIN_INTERVAL_MS
      });

      dispatch({
        type: ACTIONS.REMOTE_SYNC_END,
        payload: { error: null, syncedAt: fetchedAt, reason }
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
  }, [dispatch]);

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
    cacheMaxAgeMs: APP_CACHE_MAX_AGE_MS,
    fetchCooldownMs: REMOTE_FETCH_MIN_INTERVAL_MS
  };
}
