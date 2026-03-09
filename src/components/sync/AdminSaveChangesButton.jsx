import React, { useCallback, useMemo, useState } from 'react';
import { Button, Whisper, Tooltip } from 'rsuite';
import styles from './AdminSaveChangesButton.module.css';
import { useAppState } from '../../context/AppStateContext';
import { persistSnapshot, isLocalRuntime } from './saveStateHelpers';

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

    const result = await persistSnapshot(state, dispatch);

    if (!result.ok) {
      setSaveError(result.error || 'Local save failed.');
      setIsSaving(false);
      return;
    }

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
          size="m"
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
