import { useEffect, useMemo, useRef } from 'react';
import { ACTIONS } from '../context/appReducer';
import { getPersistedSnapshot } from '../services/localStorageService';
import { hashObject } from '../utils/stableHash';

/**
 * Tracks whether the admin has made changes since the last exported snapshot.
 * This drives the "Save changes" button visibility.
 */
export function useDirtyTracker(state, dispatch) {
  const snapshotHash = useMemo(() => hashObject(getPersistedSnapshot(state)), [state.nodes, state.edges, state.viewport, state.appSettings]);

  const lastFlagRef = useRef(null);

  useEffect(() => {
    if (!state.isAdminAuthenticated) {
      if (lastFlagRef.current !== false) {
        dispatch({ type: ACTIONS.SET_CLEAN });
        lastFlagRef.current = false;
      }
      return;
    }

    const isDirty = !state.lastExportHash || String(state.lastExportHash) !== String(snapshotHash);

    if (lastFlagRef.current !== isDirty) {
      dispatch({ type: isDirty ? ACTIONS.SET_DIRTY : ACTIONS.SET_CLEAN });
      lastFlagRef.current = isDirty;
    }
  }, [dispatch, snapshotHash, state.isAdminAuthenticated, state.lastExportHash]);
}
