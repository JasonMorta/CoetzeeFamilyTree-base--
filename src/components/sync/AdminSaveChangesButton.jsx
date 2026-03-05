import React, { useCallback } from 'react';
import { Button } from 'rsuite';
import styles from './AdminSaveChangesButton.module.css';
import { useAppState } from '../../context/AppStateContext';
import { ACTIONS } from '../../context/appReducer';
import { getPersistedSnapshot, saveAppMeta } from '../../services/localStorageService';
import { hashObject } from '../../utils/stableHash';
import { APP_METADATA } from '../../constants/defaults';

function downloadJsonFile(filename, jsonObject) {
  const blob = new Blob([JSON.stringify(jsonObject, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Let the browser start the download before releasing the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 400);
}

export default function AdminSaveChangesButton() {
  const { state, dispatch } = useAppState();

  const handleExport = useCallback(() => {
    const snapshot = getPersistedSnapshot(state);
    const hash = hashObject(snapshot);

    const payload = {
      meta: {
        hash,
        exportedAt: new Date().toISOString(),
        appVersion: APP_METADATA.version
      },
      data: snapshot
    };

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `family-tree-state_${stamp}.json`;

    downloadJsonFile(filename, payload);

    // Persist meta locally so the "dirty" tracker knows we've exported.
    saveAppMeta({ hash, exportedAt: payload.meta.exportedAt });
    dispatch({ type: ACTIONS.SET_EXPORT_HASH, payload: hash });
  }, [dispatch, state]);

  if (!state.isAdminAuthenticated) {
    return null;
  }

  // Only show after a change has been made.
  if (!state.isDirty) {
    return null;
  }

  return (
    <Button
      appearance="primary"
      color="green"
      className={styles.saveButton}
      onClick={handleExport}
      size="sm"
    >
      Save changes
    </Button>
  );
}
