import React, { useCallback, useMemo, useState } from 'react';
import { Button, Whisper, Tooltip } from 'rsuite';
import styles from './AdminSaveChangesButton.module.css';
import { useAppState } from '../../context/AppStateContext';
import { ACTIONS } from '../../context/appReducer';
import { getPersistedSnapshot, saveAppData, saveAppMeta } from '../../services/localStorageService';
import { hashObject } from '../../utils/stableHash';
import { APP_METADATA } from '../../constants/defaults';
import { saveLocalSnapshot } from '../../services/remoteStateService';

function isLocalRuntime() {
  if (typeof window === 'undefined') return false;

  const host = window.location.hostname;
  return (
    import.meta.env.DEV ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]'
  );
}

export default function AdminSaveChangesButton() {
  const { state, dispatch } = useAppState();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const canWriteLocally = useMemo(() => isLocalRuntime(), []);

  const handleSave = useCallback(async () => {
    if (!canWriteLocally || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError('');

    // Keep the working browser copy up to date every time the manual save button is used,
    // even if the caller changed something that the UI's dirty badge missed.
    saveAppData(state);

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

    const result = await saveLocalSnapshot(payload);

    if (!result.ok) {
      setSaveError(result.error || 'Local save failed.');
      setIsSaving(false);
      return;
    }

    saveAppMeta({ hash, exportedAt: payload.meta.exportedAt });
    dispatch({ type: ACTIONS.SET_EXPORT_HASH, payload: hash });
    setIsSaving(false);
  }, [canWriteLocally, dispatch, isSaving, state]);

  if (!state.isAdminAuthenticated) {
    return null;
  }

  const isDisabled = !canWriteLocally || isSaving;
  const tooltipText = !canWriteLocally
    ? 'Saving to the JSON file is available locally only.'
    : saveError
      ? saveError
      : 'Write the current app state to the local JSON file.';

  return (
    <Whisper
      placement="bottomEnd"
      trigger="hover"
      speaker={<Tooltip>{tooltipText}</Tooltip>}
    >
      <span>
        <Button
          appearance="primary"
          color={saveError ? 'red' : state.isDirty ? 'green' : undefined}
          className={styles.saveButton}
          onClick={handleSave}
          loading={isSaving}
          disabled={isDisabled}
          size="sm"
        >
          {!canWriteLocally
            ? 'Save changes (local only)'
            : saveError
              ? 'Save failed'
              : isSaving
                ? 'Saving…'
                : 'Save changes'}
        </Button>
      </span>
    </Whisper>
  );
}
