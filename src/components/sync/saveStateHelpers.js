import { getPersistedSnapshot, saveAppData, saveAppMeta } from '../../services/localStorageService';
import { hashObject } from '../../utils/stableHash';
import { APP_METADATA } from '../../constants/defaults';
import { ACTIONS } from '../../context/appReducer';
import { saveFirebaseAppStateSnapshot } from '../../services/firebaseAppStateService';
import { requireAdminSession } from '../../services/authService';

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
  try {
    requireAdminSession();
  } catch (error) {
    return { ok: false, error: error?.message || 'Admin session required.' };
  }

  saveAppData(state);

  const snapshot = getPersistedSnapshot(state);
  const hash = hashObject(snapshot);
  const exportedAt = new Date().toISOString();

  try {
    const result = await saveFirebaseAppStateSnapshot(snapshot, {
      hash,
      exportedAt,
      appVersion: APP_METADATA.version
    });

    if (!result.ok) {
      return { ok: false, error: result.error || 'Firebase save failed.' };
    }

    saveAppMeta({ hash, exportedAt });
    dispatch({ type: ACTIONS.SET_EXPORT_HASH, payload: hash });
    dispatch({
      type: ACTIONS.SET_REMOTE_SNAPSHOT_META,
      payload: {
        hash,
        computedHash: hash,
        exportedAt,
        appVersion: APP_METADATA.version
      }
    });

    return { ok: true, hash, exportedAt };
  } catch (error) {
    return { ok: false, error: error?.message || 'Firebase save failed.' };
  }
}
