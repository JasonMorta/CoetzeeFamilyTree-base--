import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { DEFAULT_APP_STATE } from '../constants/defaults';
import { ACTIONS, appReducer } from './appReducer';
import { getPersistedAppDataStatus, loadAppData, loadAppMeta } from '../services/localStorageService';
import { loadAuthState, logoutAdmin, touchAdminSession, isAdminSessionValid } from '../services/authService';
import { useLocalStorageSync } from '../hooks/useLocalStorageSync';
import { useDirtyTracker } from '../hooks/useDirtyTracker';

const AppStateContext = createContext(null);

function createInitialState() {
  const meta = loadAppMeta();
  const authState = loadAuthState();
  const cacheStatus = getPersistedAppDataStatus();
  const shouldBootstrapFromCache = cacheStatus.isFresh;
  const cachedAppData = shouldBootstrapFromCache ? loadAppData() : null;

  return {
    ...DEFAULT_APP_STATE,
    ...(cachedAppData || {}),
    ...authState,
    lastExportHash: meta.hash || null,
    lastRemoteSyncAt: shouldBootstrapFromCache ? (cacheStatus.cachedAt || Date.now()) : null,
    remoteSnapshotHash: meta.hash || null,
    remoteSnapshotExportedAt: meta.exportedAt || null,
    hasInitialRemoteSyncCompleted: shouldBootstrapFromCache
  };
}

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);

  useLocalStorageSync(state);
  useDirtyTracker(state, dispatch);

  useEffect(() => {
    if (!state.isAdminAuthenticated) {
      return undefined;
    }

    const syncSession = () => {
      if (!isAdminSessionValid()) {
        logoutAdmin();
        dispatch({ type: ACTIONS.LOGOUT });
        return;
      }
      touchAdminSession();
    };

    const handleActivity = () => {
      touchAdminSession();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncSession();
      }
    };

    const intervalId = window.setInterval(syncSession, 60_000);
    window.addEventListener('pointerdown', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('pointerdown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [dispatch, state.isAdminAuthenticated]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}
