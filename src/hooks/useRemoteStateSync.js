import { useCallback, useEffect, useRef } from 'react';
import { ACTIONS } from '../context/appReducer';
import { fetchRemoteSnapshot } from '../services/remoteStateService';
import { saveAppMeta } from '../services/localStorageService';

import { LOCAL_STATE_PATH } from '../services/remoteStateService';

const REMOTE_URL = LOCAL_STATE_PATH;

/**
 * Keeps viewer clients in sync with the bundled JSON state snapshot.
 *
 * - On load: fetch the latest bundled JSON and always apply it as the startup source of truth.
 * - Logged-in admins can then keep working from in-memory state, with localStorage acting as a session cache only after the JSON has loaded.
 * - Exposes a manual refresh action with a 30s cooldown (for viewers).
 */
export function useRemoteStateSync(state, dispatch) {
  const inFlightRef = useRef(false);

  const runSync = useCallback(async (reason = 'auto') => {
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

    const remoteHash = result.meta.hash || result.meta.computedHash;

    dispatch({ type: ACTIONS.APPLY_REMOTE_SNAPSHOT, payload: result.snapshot });

    // Save meta so admins can see what was last pulled/exported.
    saveAppMeta({ hash: remoteHash, exportedAt: result.meta.exportedAt || new Date().toISOString() });
    dispatch({ type: ACTIONS.SET_EXPORT_HASH, payload: remoteHash });

    dispatch({
      type: ACTIONS.REMOTE_SYNC_END,
      payload: { error: null, syncedAt: Date.now(), reason }
    });

    inFlightRef.current = false;
    return { ok: true };
  }, [dispatch]);

  // Auto-run on mount so both local admins and live viewers start from the saved JSON file.
  useEffect(() => {
    runSync('auto');
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
