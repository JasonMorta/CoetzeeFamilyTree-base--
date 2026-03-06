import React, { createContext, useContext, useMemo, useReducer, useEffect } from 'react';
import { DEFAULT_APP_STATE } from '../constants/defaults';
import { appReducer, ACTIONS } from './appReducer';
import { loadAppData, loadAppMeta, loadAppDataFromIndexedDb } from '../services/localStorageService';
import { loadAuthState } from '../services/authService';
import { useLocalStorageSync } from '../hooks/useLocalStorageSync';
import { useDirtyTracker } from '../hooks/useDirtyTracker';

const AppStateContext = createContext(null);

function createInitialState() {
  const appData = loadAppData();
  const meta = loadAppMeta();
  const authState = loadAuthState();
  return {
    ...DEFAULT_APP_STATE,
    ...appData,
    ...authState,
    lastExportHash: meta.hash || null
  };
}

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);

  useLocalStorageSync(state);
  useDirtyTracker(state, dispatch);

  useEffect(() => {
    const hasLocal = !!window.localStorage.getItem('familyTreeAppData');
    if (hasLocal) return;
    // If localStorage is empty, try IndexedDB snapshot
    loadAppDataFromIndexedDb().then((snapshot) => {
      if (!snapshot) return;
      dispatch({ type: ACTIONS.APPLY_REMOTE_SNAPSHOT, payload: snapshot });
    });
  }, []);


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
