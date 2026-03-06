import { useEffect } from 'react';
import { saveAppData } from '../services/localStorageService';

export function useLocalStorageSync(state) {
  useEffect(() => {
    if (!state.isAdminAuthenticated) {
      return undefined;
    }

    if (!state.lastRemoteSyncAt) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      saveAppData(state);
    }, 150);

    return () => window.clearTimeout(timer);
  }, [
    state.isAdminAuthenticated,
    state.lastRemoteSyncAt,
    state.nodes,
    state.edges,
    state.viewport,
    state.appSettings,
    state.savedPeople
  ]);
}
