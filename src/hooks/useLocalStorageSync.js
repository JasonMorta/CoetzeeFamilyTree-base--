import { useEffect, useMemo, useRef } from 'react';
import { getPersistedSnapshot, saveAppData } from '../services/localStorageService';
import { hashObject } from '../utils/stableHash';

export function useLocalStorageSync(state) {
  const snapshotHash = useMemo(
    () => hashObject(getPersistedSnapshot(state)),
    [state.nodes, state.edges, state.viewport, state.appSettings, state.savedPeople]
  );

  const lastSavedHashRef = useRef(null);

  useEffect(() => {
    if (!state.isAdminAuthenticated) {
      return undefined;
    }

    // Wait for the initial JSON bootstrap before treating localStorage as the active working copy.
    if (!state.lastRemoteSyncAt) {
      return undefined;
    }

    if (lastSavedHashRef.current === snapshotHash) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      saveAppData(state);
      lastSavedHashRef.current = snapshotHash;
    }, 120);

    return () => window.clearTimeout(timer);
  }, [state, snapshotHash]);
}
