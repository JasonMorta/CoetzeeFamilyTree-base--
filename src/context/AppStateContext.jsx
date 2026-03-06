import React, { createContext, useContext, useMemo, useReducer } from 'react';
import { DEFAULT_APP_STATE } from '../constants/defaults';
import { appReducer } from './appReducer';
import { loadAppMeta } from '../services/localStorageService';
import { loadAuthState } from '../services/authService';
import { useLocalStorageSync } from '../hooks/useLocalStorageSync';
import { useDirtyTracker } from '../hooks/useDirtyTracker';

const AppStateContext = createContext(null);

function createInitialState() {
  const meta = loadAppMeta();
  const authState = loadAuthState();

  return {
    ...DEFAULT_APP_STATE,
    ...authState,
    lastExportHash: meta.hash || null
  };
}

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);

  useLocalStorageSync(state);
  useDirtyTracker(state, dispatch);


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
