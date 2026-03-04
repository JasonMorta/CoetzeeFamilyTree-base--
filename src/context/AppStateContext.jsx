import React, { createContext, useContext, useMemo, useReducer } from 'react';
import { DEFAULT_APP_STATE } from '../constants/defaults';
import { appReducer } from './appReducer';
import { loadAppData } from '../services/localStorageService';
import { loadAuthState } from '../services/authService';
import { useLocalStorageSync } from '../hooks/useLocalStorageSync';

const AppStateContext = createContext(null);

function createInitialState() {
  const appData = loadAppData();
  const authState = loadAuthState();
  return {
    ...DEFAULT_APP_STATE,
    ...appData,
    ...authState
  };
}

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);

  useLocalStorageSync(state);

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
