import React, { useCallback, useState } from 'react';
import { Button, Whisper, Tooltip } from 'rsuite';
import { useAppState } from '../../context/AppStateContext';
import { persistSnapshot } from './saveStateHelpers';
import { ACTIONS } from '../../context/appReducer';
import { getCurrentViewportProfile, VIEWPORT_PROFILES } from '../../utils/viewportProfiles';
import styles from './AdminSaveChangesButton.module.css';

export default function AdminSaveViewButton() {
  const { state, dispatch } = useAppState();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSaveView = useCallback(async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError('');

    const currentProfile = getCurrentViewportProfile();
    const nextState = {
      ...state,
      appSettings: {
        ...state.appSettings,
        startupViewport: state.viewport,
        ...(currentProfile === VIEWPORT_PROFILES.MOBILE
          ? { startupViewportMobile: state.viewport }
          : { startupViewportDesktop: state.viewport })
      }
    };

    dispatch({ type: ACTIONS.SAVE_STARTUP_VIEWPORT, payload: { profile: currentProfile } });
    const result = await persistSnapshot(nextState, dispatch);

    if (!result.ok) {
      setSaveError(result.error || 'Firebase view save failed.');
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
  }, [dispatch, isSaving, state]);

  if (!state.isAdminAuthenticated) {
    return null;
  }

  const currentProfile = getCurrentViewportProfile();
  const tooltipText = saveError
    ? saveError
    : currentProfile === VIEWPORT_PROFILES.MOBILE
      ? 'Save the current pan and zoom as the default mobile startup view in Firebase.'
      : 'Save the current pan and zoom as the default desktop startup view in Firebase.';

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
          disabled={isSaving}
          size="xs"
        >
          {saveError
            ? 'View save failed'
            : isSaving
              ? 'Saving view…'
              : 'Save map view'}
        </Button>
      </span>
    </Whisper>
  );
}
