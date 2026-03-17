import React, { useCallback, useMemo, useState } from 'react';
import { Button, Modal, Whisper, Tooltip } from 'rsuite';
import { useAppState } from '../../context/AppStateContext';
import { ACTIONS } from '../../context/appReducer';
import { getPersistedSnapshot, saveAppData } from '../../services/localStorageService';
import { APP_METADATA } from '../../constants/defaults';
import { backfillSavedPeopleDocumentIds } from '../../utils/family3Schema';
import { applySavedPeopleRecordIdsToNodes } from '../../utils/firebaseLibraryState';
import { hashObject } from '../../utils/stableHash';
import {
  getFirebaseAppStateCollectionName,
  getLegacyFirebaseAppStateCollectionName,
  getFirebaseAppStateDocumentNames,
  isFirebaseAppStateConfigured,
  migrateLocalSnapshotToFirebase,
  saveFirebaseAppStateSnapshot
} from '../../services/firebaseAppStateService';
import styles from './AdminMigrateFirebaseButton.module.css';
import { FAMILY_DISPLAY_NAME, FAMILY_SLUG } from '../../config/familyConfig';
import { getFirebasePeopleCollectionName, getLegacyFirebasePeopleCollectionName, syncLegacyPeopleCollectionToFamilyScope } from '../../services/firebasePeopleService';

function buildMigrationPayload(state) {
  saveAppData(state);

  const snapshot = getPersistedSnapshot(state);
  const hash = hashObject(snapshot);
  const exportedAt = new Date().toISOString();
  const meta = {
    hash,
    exportedAt,
    appVersion: APP_METADATA.version,
    migrationSource: 'local-json-admin-button'
  };

  return {
    configPayload: {
      meta,
      data: {
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        viewport: snapshot.viewport,
        appSettings: snapshot.appSettings
      }
    },
    savedPeoplePayload: {
      meta,
      data: {
        savedPeople: snapshot.savedPeople
      }
    },
    legacyCombinedPayload: {
      meta,
      data: snapshot
    }
  };
}

export default function AdminMigrateFirebaseButton() {
  const { state, dispatch } = useAppState();
  const [isOpen, setIsOpen] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [isBackfillingIds, setIsBackfillingIds] = useState(false);
  const [status, setStatus] = useState('');
  const [statusTone, setStatusTone] = useState('neutral');
  const [isMigratingFamilyScope, setIsMigratingFamilyScope] = useState(false);
  const [isMigratingSubmissions, setIsMigratingSubmissions] = useState(false);

  const isConfigured = useMemo(() => isFirebaseAppStateConfigured(), []);
  const collectionName = useMemo(() => getFirebaseAppStateCollectionName(), []);
  const legacyCollectionName = useMemo(() => getLegacyFirebaseAppStateCollectionName(), []);
  const submissionsCollectionName = useMemo(() => getFirebasePeopleCollectionName(), []);
  const legacySubmissionsCollectionName = useMemo(() => getLegacyFirebasePeopleCollectionName(), []);
  const documentNames = useMemo(() => getFirebaseAppStateDocumentNames(), []);

  const handleMigrate = useCallback(async () => {
    if (!isConfigured || isMigrating || isMigratingFamilyScope || isMigratingSubmissions) {
      return;
    }

    setIsMigrating(true);
    setStatus('Writing the current local app snapshot to Firebase…');
    setStatusTone('neutral');

    try {
      const payload = buildMigrationPayload(state);
      await migrateLocalSnapshotToFirebase(payload);
      setStatus('Migration complete. Firebase now has familytree.config, familyTreeAppSavedPeople, and family-tree-state for this app snapshot.');
      setStatusTone('success');
    } catch (error) {
      setStatus(error?.message || 'Migration failed.');
      setStatusTone('error');
    } finally {
      setIsMigrating(false);
    }
  }, [isConfigured, isMigrating, isMigratingFamilyScope, isMigratingSubmissions, state]);


  const handleMigrateToFamilyScope = useCallback(async () => {
    if (!isConfigured || isMigrating || isNormalizing || isBackfillingIds || isMigratingFamilyScope) {
      return;
    }

    setIsMigratingFamilyScope(true);
    setStatus(`Writing the current app state into the family-scoped Firebase collection ${collectionName}…`);
    setStatusTone('neutral');

    try {
      const currentSnapshot = getPersistedSnapshot(state);
      saveAppData(currentSnapshot);
      await saveFirebaseAppStateSnapshot(currentSnapshot, { appVersion: APP_METADATA.version });
      setStatus(`Family-scoped Firebase collection updated for ${FAMILY_DISPLAY_NAME} (${FAMILY_SLUG}). Active collection: ${collectionName}.`);
      setStatusTone('success');
    } catch (error) {
      setStatus(error?.message || 'Family-scoped migration failed.');
      setStatusTone('error');
    } finally {
      setIsMigratingFamilyScope(false);
    }
  }, [collectionName, isBackfillingIds, isConfigured, isMigrating, isMigratingFamilyScope, isNormalizing, state]);


  const handleMigrateSubmissionsToFamilyScope = useCallback(async () => {
    if (!isConfigured || isMigrating || isNormalizing || isBackfillingIds || isMigratingFamilyScope || isMigratingSubmissions) {
      return;
    }

    setIsMigratingSubmissions(true);
    setStatus(`Copying legacy form submissions into ${submissionsCollectionName}…`);
    setStatusTone('neutral');

    try {
      const result = await syncLegacyPeopleCollectionToFamilyScope();
      setStatus(result.copiedCount
        ? `Copied ${result.copiedCount} form submission document${result.copiedCount === 1 ? '' : 's'} from ${result.sourceCollectionName} to ${result.collectionName}.`
        : `No legacy form submissions needed copying. Active submissions collection: ${result.collectionName}.`);
      setStatusTone('success');
    } catch (error) {
      setStatus(error?.message || 'Form submissions migration failed.');
      setStatusTone('error');
    } finally {
      setIsMigratingSubmissions(false);
    }
  }, [isBackfillingIds, isConfigured, isMigrating, isMigratingFamilyScope, isMigratingSubmissions, isNormalizing, submissionsCollectionName]);


  const handleBackfillSavedPeopleIds = useCallback(async () => {
    if (!isConfigured || isMigrating || isNormalizing || isBackfillingIds || isMigratingFamilyScope || isMigratingSubmissions) {
      return;
    }

    setIsBackfillingIds(true);
    setStatus('Backfilling missing saved-people external edit IDs…');
    setStatusTone('neutral');

    try {
      const { savedPeople: nextSavedPeople, changedCount } = backfillSavedPeopleDocumentIds(state.savedPeople);
      const nextNodes = applySavedPeopleRecordIdsToNodes(state.nodes, nextSavedPeople);
      const nextSnapshot = getPersistedSnapshot({
        ...state,
        nodes: nextNodes,
        savedPeople: nextSavedPeople
      });
      saveAppData(nextSnapshot);
      await saveFirebaseAppStateSnapshot(nextSnapshot, { appVersion: APP_METADATA.version });
      dispatch({ type: ACTIONS.SET_SAVED_PEOPLE, payload: nextSavedPeople });
      dispatch({ type: ACTIONS.SET_NODES, payload: nextNodes });
      setStatus(changedCount
        ? `Backfilled ${changedCount} missing saved-people external edit ID${changedCount === 1 ? '' : 's'} and synced them to Firebase.`
        : 'All saved people already had external edit IDs. No changes were needed.');
      setStatusTone('success');
    } catch (error) {
      setStatus(error?.message || 'Saved-people ID backfill failed.');
      setStatusTone('error');
    } finally {
      setIsBackfillingIds(false);
    }
  }, [dispatch, isBackfillingIds, isConfigured, isMigrating, isMigratingFamilyScope, isMigratingSubmissions, isNormalizing, state]);

  const handleNormalizeSavedPeople = useCallback(async () => {
    if (!isConfigured || isMigrating || isNormalizing || isBackfillingIds || isMigratingFamilyScope || isMigratingSubmissions) {
      return;
    }

    setIsNormalizing(true);
    setStatus('Normalizing saved people to the current form-aligned person structure…');
    setStatusTone('neutral');

    try {
      const normalizedSavedPeople = getPersistedSnapshot({ ...state, savedPeople: state.savedPeople }).savedPeople;
      const normalizedSnapshot = getPersistedSnapshot({ ...state, savedPeople: normalizedSavedPeople });
      saveAppData(normalizedSnapshot);
      await saveFirebaseAppStateSnapshot(normalizedSnapshot, { appVersion: APP_METADATA.version });
      dispatch({ type: ACTIONS.SET_SAVED_PEOPLE, payload: normalizedSavedPeople });
      setStatus('Saved people normalized and synced back to Firebase. Legacy person-only fields not used by the form were removed where applicable.');
      setStatusTone('success');
    } catch (error) {
      setStatus(error?.message || 'Saved-people normalization failed.');
      setStatusTone('error');
    } finally {
      setIsNormalizing(false);
    }
  }, [dispatch, isBackfillingIds, isConfigured, isMigrating, isMigratingFamilyScope, isMigratingSubmissions, isNormalizing, state]);

  if (!state.isAdminAuthenticated) {
    return null;
  }

  const tooltipText = isConfigured
    ? 'Push the current local JSON snapshot to Firebase, normalize saved people, backfill missing saved-people edit IDs, or sync the live tree into the family-scoped Firebase collection built from the env slug.'
    : 'Firebase app-state migration is not configured.';

  return (
    <>
      <Whisper placement="bottomEnd" trigger="hover" speaker={<Tooltip>{tooltipText}</Tooltip>}>
        <span>
          <Button
            appearance="ghost"
            color="orange"
            size="xs"
            onClick={() => setIsOpen(true)}
            disabled={!isConfigured}
            className={styles.button}
          >
            Migrate local data to Firebase
          </Button>
        </span>
      </Whisper>

      <Modal open={isOpen} onClose={() => !(isMigrating || isNormalizing || isBackfillingIds || isMigratingFamilyScope || isMigratingSubmissions) && setIsOpen(false)} size="sm" className={styles.modal}>
        <Modal.Header>
          <Modal.Title>Firebase migration</Modal.Title>
        </Modal.Header>
        <Modal.Body className={styles.body}>
          <div className={styles.text}>
            This app now derives its Firebase collection names from the family slug in <strong>.env</strong>. The active collection is family-scoped, while the legacy generic collection remains available as a fallback read until you migrate.
          </div>
          <div className={styles.metaCard}>
            <div><strong>Family display name:</strong> {FAMILY_DISPLAY_NAME}</div>
            <div><strong>Family slug:</strong> {FAMILY_SLUG}</div>
            <div><strong>Active collection:</strong> {collectionName}</div>
            <div><strong>Legacy fallback collection:</strong> {legacyCollectionName}</div>
            <div><strong>Active submissions collection:</strong> {submissionsCollectionName}</div>
            <div><strong>Legacy submissions collection:</strong> {legacySubmissionsCollectionName}</div>
            <div><strong>Config document:</strong> {documentNames.config}</div>
            <div><strong>Saved people document:</strong> {documentNames.savedPeople}</div>
            <div><strong>Legacy combined document:</strong> {documentNames.legacyState}</div>
          </div>
          <div className={styles.text}>
            The saved-people document name stays <strong>familyTreeAppSavedPeople</strong>. Only the outer Firebase collection name changes by family slug.
          </div>
          <div className={styles.text}>
            You can also normalize the saved-people library so each <strong>person</strong> object matches the form-aligned structure while keeping future unknown person fields intact.
          </div>
          <div className={styles.text}>
            If older saved people are missing their external edit ID in <strong>firebaseDocumentId</strong>, you can backfill those IDs here. New people imported from form submissions will carry over the submission document ID automatically when available.
          </div>
          <div className={styles.text}>
            You can also copy the legacy generic form submissions collection into the new family-scoped submissions collection so the "Add form submission" flow uses the family-specific Firebase source.
          </div>
          {status ? <div className={`${styles.status} ${statusTone === 'success' ? styles.success : statusTone === 'error' ? styles.error : ''}`}>{status}</div> : null}
        </Modal.Body>
        <Modal.Footer>
          <Button appearance="subtle" onClick={() => setIsOpen(false)} disabled={isMigrating || isNormalizing || isBackfillingIds || isMigratingFamilyScope || isMigratingSubmissions}>Close</Button>
          <Button appearance="ghost" color="green" onClick={handleMigrateToFamilyScope} loading={isMigratingFamilyScope} disabled={isMigrating || isNormalizing || isBackfillingIds || isMigratingSubmissions}>
            Sync to family collection
          </Button>
          <Button appearance="ghost" color="cyan" onClick={handleMigrateSubmissionsToFamilyScope} loading={isMigratingSubmissions} disabled={isMigrating || isNormalizing || isBackfillingIds || isMigratingFamilyScope}>
            Sync form submissions
          </Button>
          <Button appearance="ghost" color="violet" onClick={handleNormalizeSavedPeople} loading={isNormalizing} disabled={isMigrating || isBackfillingIds || isMigratingFamilyScope || isMigratingSubmissions}>
            Normalize saved people
          </Button>
          <Button appearance="ghost" color="blue" onClick={handleBackfillSavedPeopleIds} loading={isBackfillingIds} disabled={isMigrating || isNormalizing || isMigratingFamilyScope || isMigratingSubmissions}>
            Backfill saved people IDs
          </Button>
          <Button appearance="primary" color="orange" onClick={handleMigrate} loading={isMigrating} disabled={isNormalizing || isBackfillingIds || isMigratingFamilyScope || isMigratingSubmissions}>
            Run migration
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
