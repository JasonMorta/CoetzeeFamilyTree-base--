import { useCallback, useEffect, useRef } from 'react';
import { ACTIONS } from '../context/appReducer';
import { fetchRemoteSnapshot } from '../services/remoteStateService';
import { getPersistedSnapshot, saveAppMeta } from '../services/localStorageService';
import { hashObject } from '../utils/stableHash';

// Paste your Google Drive "direct JSON" URL into VITE_REMOTE_STATE_URL in .env
const REMOTE_URL = import.meta.env.VITE_REMOTE_STATE_URL || '';


function shouldApplyRemote(localHash, remoteHash) {
  // If nothing exists locally, remote becomes the source of truth.
  if (!localHash) return true;
  // Apply remote only if it's different.
  return String(localHash) !== String(remoteHash);
}

/**
 * Keeps viewer clients in sync with a remote JSON "state snapshot" (hosted on Google Drive).
 *
 * - On load: fetch remote and compare to localStorage snapshot.
 * - If remote differs, apply remote snapshot and let the existing localStorage sync persist it.
 * - Exposes a manual refresh action with a 30s cooldown (for viewers).
 */
export function useRemoteStateSync(state, dispatch) {
  const inFlightRef = useRef(false);

  const runSync = useCallback(async (reason = 'auto') => {
    if (!REMOTE_URL) {
      return { ok: false, skipped: true, reason: 'No remote URL configured.' };
    }
    if (inFlightRef.current) {
      return { ok: false, skipped: true, reason: 'Sync already in progress.' };
    }

    inFlightRef.current = true;
    dispatch({ type: ACTIONS.REMOTE_SYNC_START, payload: { reason } });

    const result = await fetchRemoteSnapshot(REMOTE_URL);

    if (!result.ok) {
      dispatch({
        type: ACTIONS.REMOTE_SYNC_END,
        payload: { error: result.error, syncedAt: Date.now(), reason }
      });
      inFlightRef.current = false;
      return result;
    }

    const localSnapshot = getPersistedSnapshot(state);
    const localHash = hashObject(localSnapshot);

    const remoteHash = result.meta.hash || result.meta.computedHash;

    if (shouldApplyRemote(localHash, remoteHash)) {
      dispatch({ type: ACTIONS.APPLY_REMOTE_SNAPSHOT, payload: result.snapshot });

      // Save meta so admins can see what was last pulled/exported.
      saveAppMeta({ hash: remoteHash, exportedAt: result.meta.exportedAt || new Date().toISOString() });
      dispatch({ type: ACTIONS.SET_EXPORT_HASH, payload: remoteHash });
    }

    dispatch({
      type: ACTIONS.REMOTE_SYNC_END,
      payload: { error: null, syncedAt: Date.now(), reason }
    });

    inFlightRef.current = false;
    return { ok: true };
  }, [dispatch, state]);

  // Auto-run on mount. This is what keeps public visitors up to date.
  useEffect(() => {
    // Only auto-sync for viewers. Admins already have live local edits.
    if (!state.isAdminAuthenticated) {
      runSync('auto');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshWithCooldown = useCallback(async () => {
    const now = Date.now();
    if (state.remoteCooldownUntil && now < state.remoteCooldownUntil) {
      return { ok: false, skipped: true, reason: 'Cooldown active.' };
    }

    // 30 second cooldown
    dispatch({ type: ACTIONS.SET_REMOTE_COOLDOWN, payload: now + 30_000 });
    return runSync('manual');
  }, [dispatch, runSync, state.remoteCooldownUntil]);

  return { refreshWithCooldown, runSync, remoteUrl: REMOTE_URL };
}
