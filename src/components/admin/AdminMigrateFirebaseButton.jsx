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
  readFirebaseAppStateDocuments,
  saveFirebaseAppStateSnapshot
} from '../../services/firebaseAppStateService';
import styles from './AdminMigrateFirebaseButton.module.css';
import { FAMILY_DISPLAY_NAME, FAMILY_SLUG } from '../../config/familyConfig';
import {
  fetchFirebasePeopleList,
  getFirebasePeopleCollectionName,
  getLegacyFirebasePeopleCollectionName,
  syncLegacyPeopleCollectionToFamilyScope
} from '../../services/firebasePeopleService';
import { isLocalRuntime } from '../sync/saveStateHelpers';

const LOCAL_DEBUG_EXPORT_ROUTE = '/__local-state/save';

function mapDocumentsById(documents) {
  return Array.isArray(documents)
    ? documents.reduce((accumulator, item) => {
        if (item?.id) {
          accumulator[item.id] = item;
        }
        return accumulator;
      }, {})
    : {};
}

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

async function saveFirebaseDebugExportLocally(payload) {
  const response = await fetch(LOCAL_DEBUG_EXPORT_ROUTE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error || 'Local debug export failed.');
  }

  return result;
}

function ActionCard({ title, description, meta, children }) {
  return (
    <section className={styles.actionCard}>
      <div className={styles.actionCopy}>
        <div className={styles.actionTitle}>{title}</div>
        <div className={styles.actionDescription}>{description}</div>
        {meta ? <div className={styles.actionMeta}>{meta}</div> : null}
      </div>
      <div className={styles.actionControl}>{children}</div>
    </section>
  );
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
  const [isSavingFirebaseDebugExport, setIsSavingFirebaseDebugExport] = useState(false);

  const isConfigured = useMemo(() => isFirebaseAppStateConfigured(), []);
  const collectionName = useMemo(() => getFirebaseAppStateCollectionName(), []);
  const legacyCollectionName = useMemo(() => getLegacyFirebaseAppStateCollectionName(), []);
  const submissionsCollectionName = useMemo(() => getFirebasePeopleCollectionName(), []);
  const legacySubmissionsCollectionName = useMemo(() => getLegacyFirebasePeopleCollectionName(), []);
  const documentNames = useMemo(() => getFirebaseAppStateDocumentNames(), []);
  const isLocalOnlySaveVisible = useMemo(() => isLocalRuntime(), []);

  const isAnyActionRunning = isMigrating
    || isNormalizing
    || isBackfillingIds
    || isMigratingFamilyScope
    || isMigratingSubmissions
    || isSavingFirebaseDebugExport;

  const handleMigrate = useCallback(async () => {
    if (!isConfigured || isAnyActionRunning) {
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
  }, [isAnyActionRunning, isConfigured, state]);

  const handleMigrateToFamilyScope = useCallback(async () => {
    if (!isConfigured || isAnyActionRunning) {
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
  }, [collectionName, isAnyActionRunning, isConfigured, state]);

  const handleMigrateSubmissionsToFamilyScope = useCallback(async () => {
    if (!isConfigured || isAnyActionRunning) {
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
  }, [isAnyActionRunning, isConfigured, submissionsCollectionName]);

  const handleBackfillSavedPeopleIds = useCallback(async () => {
    if (!isConfigured || isAnyActionRunning) {
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
  }, [dispatch, isAnyActionRunning, isConfigured, state]);

  const handleNormalizeSavedPeople = useCallback(async () => {
    if (!isConfigured || isAnyActionRunning) {
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
  }, [dispatch, isAnyActionRunning, isConfigured, state]);

  const handleSaveFirebaseDebugExport = useCallback(async () => {
    if (!isConfigured || !isLocalOnlySaveVisible || isAnyActionRunning) {
      return;
    }

    setIsSavingFirebaseDebugExport(true);
    setStatus('Downloading the exact Firebase family-tree documents and mirroring them into public/data…');
    setStatusTone('neutral');

    try {
      const [appStateDocuments, submissions] = await Promise.all([
        readFirebaseAppStateDocuments(),
        fetchFirebasePeopleList()
      ]);

      const documentsById = mapDocumentsById(appStateDocuments);
      const configDocument = documentsById[documentNames.config] || null;
      const savedPeopleDocument = documentsById[documentNames.savedPeople] || null;
      const legacyStateDocument = documentsById[documentNames.legacyState] || null;

      if (!configDocument || !savedPeopleDocument || !legacyStateDocument) {
        throw new Error(`Could not find all required Firebase app-state documents in ${collectionName}. Expected ${documentNames.config}, ${documentNames.savedPeople}, and ${documentNames.legacyState}.`);
      }

      const exportedAt = new Date().toISOString();
      const debugPayload = {
        kind: 'firebase-debug-export',
        exportedAt,
        appVersion: APP_METADATA.version,
        family: {
          displayName: FAMILY_DISPLAY_NAME,
          slug: FAMILY_SLUG
        },
        collections: {
          appState: {
            active: collectionName,
            legacyFallback: legacyCollectionName,
            documents: appStateDocuments
          },
          submissions: {
            active: submissionsCollectionName,
            legacyFallback: legacySubmissionsCollectionName,
            documents: submissions
          }
        }
      };

      const result = await saveFirebaseDebugExportLocally({
        configPayload: configDocument,
        savedPeoplePayload: savedPeopleDocument,
        legacyCombinedPayload: legacyStateDocument,
        debugExportPayload: debugPayload
      });

      const savedPath = Array.isArray(result?.paths)
        ? result.paths.find((item) => item === 'public/data/firebase-debug-export.json')
        : 'public/data/firebase-debug-export.json';

      setStatus(`Firebase family-tree data was mirrored locally and the debug export was saved to ${savedPath}. This button is only available while running the Vite dev server locally.`);
      setStatusTone('success');
    } catch (error) {
      setStatus(error?.message || 'Local Firebase debug export failed.');
      setStatusTone('error');
    } finally {
      setIsSavingFirebaseDebugExport(false);
    }
  }, [collectionName, documentNames, isAnyActionRunning, isConfigured, isLocalOnlySaveVisible, legacyCollectionName, legacySubmissionsCollectionName, submissionsCollectionName]);

  if (!state.isAdminAuthenticated) {
    return null;
  }

  const tooltipText = isConfigured
    ? 'Open Firebase migration tools, read what each action does, and optionally save a local debug export while running the app in VS Code.'
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
            Migration options
          </Button>
        </span>
      </Whisper>

      <Modal open={isOpen} onClose={() => !isAnyActionRunning && setIsOpen(false)} size="md" className={styles.modal}>
        <Modal.Header>
          <Modal.Title>Firebase migration options</Modal.Title>
        </Modal.Header>
        <Modal.Body className={styles.body}>
          <div className={styles.text}>
            This app derives its Firebase collection names from the family slug in <strong>.env</strong>. Use the actions below to move data, clean older records, or create a local debugging export while the app is running in VS Code.
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

          <div className={styles.actionGrid}>
            <ActionCard
              title="Run migration"
              description="Push the current local app snapshot into the Firebase app-state documents. This writes the config document, the saved-people document, and the legacy combined state document."
              meta="Best when you want the current browser state mirrored into Firebase exactly as it is now."
            >
              <Button appearance="primary" color="orange" onClick={handleMigrate} loading={isMigrating} disabled={isAnyActionRunning && !isMigrating}>
                Run migration
              </Button>
            </ActionCard>

            <ActionCard
              title="Sync to family collection"
              description="Write the current app state into the family-scoped Firebase collection built from the family slug. Use this when the active family collection should become the source of truth."
              meta={`Writes into ${collectionName}.`}
            >
              <Button appearance="ghost" color="green" onClick={handleMigrateToFamilyScope} loading={isMigratingFamilyScope} disabled={isAnyActionRunning && !isMigratingFamilyScope}>
                Sync to family collection
              </Button>
            </ActionCard>

            <ActionCard
              title="Sync form submissions"
              description="Copy legacy Family3 form submission documents into the new family-scoped submissions collection so the admin submission picker reads from the family-specific source."
              meta={`Copies from ${legacySubmissionsCollectionName} into ${submissionsCollectionName}.`}
            >
              <Button appearance="ghost" color="cyan" onClick={handleMigrateSubmissionsToFamilyScope} loading={isMigratingSubmissions} disabled={isAnyActionRunning && !isMigratingSubmissions}>
                Sync form submissions
              </Button>
            </ActionCard>

            <ActionCard
              title="Normalize saved people"
              description="Clean saved-people records into the current form-aligned structure and write the normalized result back to Firebase."
              meta="Useful after schema changes so older records follow the current editor and form shape."
            >
              <Button appearance="ghost" color="violet" onClick={handleNormalizeSavedPeople} loading={isNormalizing} disabled={isAnyActionRunning && !isNormalizing}>
                Normalize saved people
              </Button>
            </ActionCard>

            <ActionCard
              title="Backfill saved people IDs"
              description="Fill in missing external edit IDs on older saved-people records, apply those IDs back onto matching nodes, and sync the updated snapshot to Firebase."
              meta="Use this when older imported people are missing firebaseDocumentId values."
            >
              <Button appearance="ghost" color="blue" onClick={handleBackfillSavedPeopleIds} loading={isBackfillingIds} disabled={isAnyActionRunning && !isBackfillingIds}>
                Backfill saved people IDs
              </Button>
            </ActionCard>

            {isLocalOnlySaveVisible ? (
              <ActionCard
                title="Save current data locally (VS code only)"
                description="Read the exact Firebase family-tree documents and save them back into the local JSON files in public/data. It also writes a full debug export file with the related submissions for troubleshooting."
                meta="Visible only on localhost / Vite dev so the app can mirror Firebase into familytree.config.json, savedPeople.json, family-tree-state.json, and firebase-debug-export.json."
              >
                <Button appearance="ghost" color="yellow" onClick={handleSaveFirebaseDebugExport} loading={isSavingFirebaseDebugExport} disabled={isAnyActionRunning && !isSavingFirebaseDebugExport}>
                  Save current data locally (VS code only)
                </Button>
              </ActionCard>
            ) : null}
          </div>

          {status ? <div className={`${styles.status} ${statusTone === 'success' ? styles.success : statusTone === 'error' ? styles.error : ''}`}>{status}</div> : null}
        </Modal.Body>
        <Modal.Footer>
          <Button appearance="subtle" onClick={() => setIsOpen(false)} disabled={isAnyActionRunning}>Close</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
