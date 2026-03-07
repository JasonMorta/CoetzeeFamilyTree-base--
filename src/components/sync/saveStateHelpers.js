import { getPersistedSnapshot, saveAppData, saveAppMeta } from '../../services/localStorageService';
import { hashObject } from '../../utils/stableHash';
import { APP_METADATA } from '../../constants/defaults';
import { saveLocalSnapshot } from '../../services/remoteStateService';
import { ACTIONS } from '../../context/appReducer';

export function isLocalRuntime() {
  if (typeof window === 'undefined') return false;

  const host = window.location.hostname;
  return (
    import.meta.env.DEV ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]'
  );
}

export async function persistSnapshot(state, dispatch) {
  // Keep the working browser copy up to date before exporting.
  saveAppData(state);

  const snapshot = getPersistedSnapshot(state);
  const hash = hashObject(snapshot);
  const exportedAt = new Date().toISOString();

  const payload = {
    meta: {
      hash,
      exportedAt,
      appVersion: APP_METADATA.version
    },
    data: snapshot
  };

  const result = await saveLocalSnapshot(payload);

  if (!result.ok) {
    return { ok: false, error: result.error || 'Local save failed.' };
  }

  saveAppMeta({ hash, exportedAt });
  dispatch({ type: ACTIONS.SET_EXPORT_HASH, payload: hash });

  return { ok: true };
}
