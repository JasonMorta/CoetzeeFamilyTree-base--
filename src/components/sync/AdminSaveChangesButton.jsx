import React, { useCallback, useState } from 'react';
import { Button, Whisper, Tooltip } from 'rsuite';
import styles from './AdminSaveChangesButton.module.css';
import { useAppState } from '../../context/AppStateContext';
import { persistSnapshot } from './saveStateHelpers';

export default function AdminSaveChangesButton() {
  const { state, dispatch } = useAppState();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSave = useCallback(async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError('');

    const result = await persistSnapshot(state, dispatch);

    if (!result.ok) {
      setSaveError(result.error || 'Firebase save failed.');
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
  }, [dispatch, isSaving, state]);

  if (!state.isAdminAuthenticated) {
    return null;
  }

  const tooltipText = saveError
    ? saveError
    : 'Write the current app state to Firebase.';

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
          disabled={isSaving}
          size="xs"
        >
          {saveError
            ? 'Save failed'
            : isSaving
              ? 'Saving…'
              : 'Save changes'}
        </Button>
      </span>
    </Whisper>
  );
}
