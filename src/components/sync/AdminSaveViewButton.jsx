import React, { useCallback, useMemo, useState } from 'react';
import { Button, Whisper, Tooltip } from 'rsuite';
import { useAppState } from '../../context/AppStateContext';
import { isLocalRuntime, persistSnapshot } from './saveStateHelpers';
import styles from './AdminSaveChangesButton.module.css';

export default function AdminSaveViewButton() {
  const { state, dispatch } = useAppState();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const canWriteLocally = useMemo(() => isLocalRuntime(), []);

  const handleSaveView = useCallback(async () => {
    if (!canWriteLocally || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError('');

    const result = await persistSnapshot(state, dispatch);

    if (!result.ok) {
      setSaveError(result.error || 'View save failed.');
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
    ? 'Saving the startup map view is available locally only.'
    : saveError
      ? saveError
      : 'Save the current pan and zoom as the startup map view.';

  return (
    <Whisper
      placement="bottomEnd"
      trigger="hover"
      speaker={<Tooltip>{tooltipText}</Tooltip>}
    >
      <span>
        <Button
          appearance="ghost"
          color={saveError ? 'red' : state.isDirty ? 'yellow' : undefined}
          className={styles.saveButton}
          onClick={handleSaveView}
          loading={isSaving}
          disabled={isDisabled}
          size="m"
        >
          {!canWriteLocally
            ? 'Save map view (local only)'
            : saveError
              ? 'View save failed'
              : isSaving
                ? 'Saving view…'
                : 'Save map view'}
        </Button>
      </span>
    </Whisper>
  );
}
