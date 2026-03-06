import { useEffect } from 'react';
import { saveAppData } from '../services/localStorageService';

export function useLocalStorageSync(state) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveAppData(state);
    }, 150);

    return () => window.clearTimeout(timer);
  }, [state.nodes, state.edges, state.viewport, state.appSettings, state.savedPeople]);
}
