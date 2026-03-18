import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Loader, Modal, Pagination } from 'rsuite';
import styles from './FirebasePeopleModal.module.css';
import { useAppState } from '../../context/AppStateContext';
import { ACTIONS } from '../../context/appReducer';
import StandardPersonFields from '../editor/StandardPersonFields';
import { createStandardPersonWrapper, getRecordName, getRecordPhoto, standardPersonToSavedRecord } from '../../utils/family3Schema';
import { fetchFirebasePeopleList, updateFirebasePersonRecord, deleteFirebasePersonRecord, isFirebasePeopleConfigured, getFirebasePeopleCollectionName, getLegacyFirebasePeopleCollectionName } from '../../services/firebasePeopleService';
import { saveFirebaseAppStateSnapshot, getFirebaseAppStateCollectionName, getFirebaseAppStateDocumentNames } from '../../services/firebaseAppStateService';
import { applySavedPersonRecordToNodes, removeSavedPersonRecord, upsertSavedPersonRecord } from '../../utils/firebaseLibraryState';
import { NODE_TYPES } from '../../utils/nodeFactory';
import { FAMILY_SLUG } from '../../config/familyConfig';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_FAMILY3_FORM_BASE_URL = 'https://family3form.mortadev.com/';
const family3FormBaseUrl = String(import.meta.env.VITE_FAMILY3_FORM_BASE_URL || DEFAULT_FAMILY3_FORM_BASE_URL).trim() || DEFAULT_FAMILY3_FORM_BASE_URL;

function buildFamily3EditLink(personExternalId) {
  const recordId = String(personExternalId || '').trim();
  if (!recordId) return '';

  try {
    const url = new URL(family3FormBaseUrl);
    url.searchParams.set('family', FAMILY_SLUG);
    url.searchParams.set('editPersonId', recordId);
    return url.toString();
  } catch (error) {
    const separator = family3FormBaseUrl.includes('?') ? '&' : '?';
    return `${family3FormBaseUrl}${separator}family=${encodeURIComponent(FAMILY_SLUG)}&editPersonId=${encodeURIComponent(recordId)}`;
  }
}

async function copyTextToClipboard(value) {
  const text = String(value || '');
  if (!text) return false;

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return copied;
}

function normalizeSearch(value) {
  return String(value || '').trim().toLowerCase();
}

function buildFirebaseNodePayload(record) {
  const standardPerson = createStandardPersonWrapper(record, { firebaseDocumentId: record.firebaseDocumentId });
  return {
    nodeType: NODE_TYPES.STANDARD,
    title: standardPerson.node?.title || standardPerson.person?.name || 'New Family Node',
    photo: standardPerson.node?.coverImage || standardPerson.person?.photo || '',
    photoCaption: standardPerson.node?.imageCaption || '',
    eventDate: standardPerson.node?.eventDate || '',
    location: standardPerson.node?.location || '',
    notes: standardPerson.node?.notes || '',
    standardPerson
  };
}

function EditFirebasePersonModal({ open, personRecord, onClose, onUpdated, sourceMode = 'submissions' }) {
  const { state, dispatch } = useAppState();
  const [draftPerson, setDraftPerson] = useState(() => createStandardPersonWrapper(personRecord || {}));
  const [statusText, setStatusText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [generatedEditLink, setGeneratedEditLink] = useState('');
  const [linkStatusText, setLinkStatusText] = useState('');

  useEffect(() => {
    if (!open) return;
    setDraftPerson(createStandardPersonWrapper(personRecord || {}));
    setStatusText('');
    setIsSaving(false);
    setGeneratedEditLink('');
    setLinkStatusText('');
  }, [open, personRecord]);

  const canGenerateEditLink = sourceMode === 'savedPeople' && Boolean(String(draftPerson?.firebaseDocumentId || personRecord?.firebaseDocumentId || '').trim());

  const handleGenerateEditLink = useCallback(async () => {
    const nextLink = buildFamily3EditLink(draftPerson?.firebaseDocumentId || personRecord?.firebaseDocumentId || '');
    if (!nextLink) {
      setLinkStatusText('This saved person is missing its external edit ID, so an edit link cannot be generated yet.');
      setGeneratedEditLink('');
      return;
    }

    setGeneratedEditLink(nextLink);
    try {
      const copied = await copyTextToClipboard(nextLink);
      setLinkStatusText(copied ? 'Edit link copied to clipboard.' : 'Edit link generated. Copy it from the field below.');
    } catch (error) {
      setLinkStatusText('Edit link generated. Copy it from the field below.');
    }
  }, [draftPerson?.firebaseDocumentId, personRecord?.firebaseDocumentId]);

  const handleSave = useCallback(async () => {
    const current = createStandardPersonWrapper(draftPerson || {});
    if (sourceMode !== 'savedPeople' && !current.firebaseDocumentId) {
      setStatusText('This person is missing a Firebase document ID.');
      return;
    }

    setIsSaving(true);
    setStatusText('Saving changes to Firebase…');

    try {
      const savedRecord = standardPersonToSavedRecord(current);

      if (sourceMode === 'savedPeople') {
        const nextSavedPeople = upsertSavedPersonRecord(state.savedPeople, savedRecord);
        const nextNodes = applySavedPersonRecordToNodes(state.nodes, savedRecord);
        await saveFirebaseAppStateSnapshot({
          nodes: nextNodes,
          edges: state.edges,
          viewport: state.viewport,
          appSettings: state.appSettings,
          savedPeople: nextSavedPeople
        });
        dispatch({ type: ACTIONS.SET_SAVED_PEOPLE, payload: nextSavedPeople });
        dispatch({ type: ACTIONS.SET_NODES, payload: nextNodes });
        setStatusText('Saved people record updated successfully.');
      } else {
        await updateFirebasePersonRecord(current.firebaseDocumentId, current);
        dispatch({ type: ACTIONS.SET_SAVED_PEOPLE, payload: upsertSavedPersonRecord(state.savedPeople, savedRecord) });
        dispatch({ type: ACTIONS.SET_NODES, payload: applySavedPersonRecordToNodes(state.nodes, savedRecord) });
        setStatusText('Firebase record updated successfully.');
      }

      onUpdated?.(savedRecord);
      window.setTimeout(() => onClose?.(), 350);
    } catch (error) {
      setStatusText(error?.message || 'Could not update Firebase right now.');
    } finally {
      setIsSaving(false);
    }
  }, [dispatch, draftPerson, onClose, onUpdated, sourceMode, state.appSettings, state.edges, state.nodes, state.savedPeople, state.viewport]);

  return (
    <Modal open={open} onClose={onClose} size="lg" className={styles.modal}>
      <Modal.Header>
        <Modal.Title>{sourceMode === 'savedPeople' ? 'Edit saved person' : 'Edit Firebase person'}</Modal.Title>
      </Modal.Header>
      <Modal.Body className={styles.editBody}>
        <div className={styles.editHint}>{sourceMode === 'savedPeople' ? 'Admin-only editor for a saved person in the Family Tree app library. Update the fields below, then save them back to the saved people document and live app state.' : 'Admin-only editor for the raw Firebase person record. Update the fields below, then save them back to the same Firebase document.'}</div>
        <StandardPersonFields
          person={draftPerson}
          setPerson={setDraftPerson}
          savedPeople={state.savedPeople}
          showSectionSaveButtons={false}
        />
        {sourceMode === 'savedPeople' ? (
          <div className={styles.linkPanel}>
            <div className={styles.linkPanelTitle}>External edit link</div>
            <div className={styles.linkPanelText}>Generate a link for the Family3 form site. That link uses this saved person's stable external edit ID so the form app can open directly in edit mode for that person.</div>
            <div className={styles.linkRow}>
              <Button appearance="ghost" onClick={handleGenerateEditLink} disabled={!canGenerateEditLink || isSaving}>Generate edit link</Button>
              <Input value={generatedEditLink} readOnly placeholder={canGenerateEditLink ? 'Generated edit link will appear here.' : 'A stable external edit ID is required before an edit link can be generated.'} className={styles.linkInput} />
            </div>
            {linkStatusText ? <div className={styles.linkStatus}>{linkStatusText}</div> : null}
          </div>
        ) : null}
        {statusText ? <div className={styles.statusText}>{statusText}</div> : null}
      </Modal.Body>
      <Modal.Footer>
        <Button appearance="subtle" onClick={onClose} disabled={isSaving}>Cancel</Button>
        <Button appearance="primary" onClick={handleSave} loading={isSaving}>{sourceMode === 'savedPeople' ? 'Update saved person' : 'Update Firebase record'}</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default function FirebasePeopleModal({ open, onClose, mode = 'submissions' }) {
  const { state, dispatch } = useAppState();

  if (!state.isAdminAuthenticated) {
    return null;
  }
  const collectionName = getFirebasePeopleCollectionName();
  const legacyCollectionName = getLegacyFirebasePeopleCollectionName();
  const appStateCollectionName = getFirebaseAppStateCollectionName();
  const appStateDocumentNames = getFirebaseAppStateDocumentNames();
  const isSavedPeopleMode = mode === 'savedPeople';
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [editRecord, setEditRecord] = useState(null);
  const [busyRowId, setBusyRowId] = useState('');

  const loadRecords = useCallback(async () => {
    if (!open) return;

    if (isSavedPeopleMode) {
      setIsLoading(true);
      setErrorText('');
      try {
        const nextRecords = Array.isArray(state.savedPeople) ? [...state.savedPeople] : [];
        nextRecords.sort((a, b) => normalizeSearch(getRecordName(a)).localeCompare(normalizeSearch(getRecordName(b))));
        setRecords(nextRecords);
      } catch (error) {
        setErrorText(error?.message || 'Could not load the saved people library.');
        setRecords([]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!isFirebasePeopleConfigured()) {
      setErrorText('Firebase people list is not configured. Add the VITE_FIREBASE_* values to .env first.');
      setRecords([]);
      return;
    }

    setIsLoading(true);
    setErrorText('');
    try {
      const nextRecords = await fetchFirebasePeopleList();
      setRecords(nextRecords);
    } catch (error) {
      setErrorText(error?.message || 'Could not load the Firebase people list.');
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [isSavedPeopleMode, open, state.savedPeople]);

  useEffect(() => {
    if (!open) return;
    void loadRecords();
  }, [open, loadRecords, state.savedPeople]);

  useEffect(() => {
    setPage(1);
  }, [searchValue, limit]);

  const filteredRecords = useMemo(() => {
    const query = normalizeSearch(searchValue);
    if (!query) return records;
    return records.filter((record) => normalizeSearch(getRecordName(record)).includes(query));
  }, [records, searchValue]);

  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredRecords.slice(start, start + limit);
  }, [filteredRecords, limit, page]);

  const handleAddPersonNode = useCallback((record) => {
    const importedRecordId = record?.firebaseDocumentId || record?.documentId || record?.id || '';
    const nextRecord = createStandardPersonWrapper(record, { firebaseDocumentId: importedRecordId });
    dispatch({
      type: ACTIONS.ADD_NODE,
      payload: {
        position: state.viewportCenter,
        dataOverrides: buildFirebaseNodePayload(nextRecord)
      }
    });
    dispatch({ type: ACTIONS.SET_SAVED_PEOPLE, payload: upsertSavedPersonRecord(state.savedPeople, nextRecord) });
    onClose?.();
  }, [dispatch, onClose, state.savedPeople, state.viewportCenter]);

  const handleDelete = useCallback(async (event, record) => {
    event.stopPropagation();
    const recordId = record?.firebaseDocumentId || getRecordName(record);
    if (!recordId) return;

    const subjectLabel = getRecordName(record) || 'this person';
    if (!window.confirm(`Delete ${subjectLabel} ${isSavedPeopleMode ? 'from saved people' : 'from Firebase'}?`)) return;

    setBusyRowId(recordId);
    setErrorText('');
    try {
      if (isSavedPeopleMode) {
        const nextSavedPeople = removeSavedPersonRecord(state.savedPeople, record.firebaseDocumentId, getRecordName(record));
        await saveFirebaseAppStateSnapshot({
          nodes: state.nodes,
          edges: state.edges,
          viewport: state.viewport,
          appSettings: state.appSettings,
          savedPeople: nextSavedPeople
        });
        dispatch({ type: ACTIONS.SET_SAVED_PEOPLE, payload: nextSavedPeople });
        setRecords((prev) => prev.filter((item) => (item.firebaseDocumentId || getRecordName(item)) !== recordId));
      } else {
        await deleteFirebasePersonRecord(record.firebaseDocumentId);
        setRecords((prev) => prev.filter((item) => item.firebaseDocumentId !== record.firebaseDocumentId));
        dispatch({ type: ACTIONS.SET_SAVED_PEOPLE, payload: removeSavedPersonRecord(state.savedPeople, record.firebaseDocumentId, getRecordName(record)) });
      }
    } catch (error) {
      setErrorText(error?.message || `Could not delete the ${isSavedPeopleMode ? 'saved people' : 'Firebase'} record.`);
    } finally {
      setBusyRowId('');
    }
  }, [dispatch, isSavedPeopleMode, state.appSettings, state.edges, state.nodes, state.savedPeople, state.viewport]);

  const handleEdit = useCallback((event, record) => {
    event.stopPropagation();
    setEditRecord(createStandardPersonWrapper(record, { firebaseDocumentId: record.firebaseDocumentId }));
  }, []);

  const handleEditSaved = useCallback((updatedRecord) => {
    const nextWrapper = createStandardPersonWrapper(updatedRecord, { firebaseDocumentId: updatedRecord.firebaseDocumentId });
    const nextName = normalizeSearch(getRecordName(nextWrapper));
    setRecords((prev) => prev.map((item) => {
      const sameId = nextWrapper.firebaseDocumentId && item.firebaseDocumentId && item.firebaseDocumentId === nextWrapper.firebaseDocumentId;
      const sameName = !nextWrapper.firebaseDocumentId && normalizeSearch(getRecordName(item)) === nextName;
      return (sameId || sameName) ? standardPersonToSavedRecord(nextWrapper) : item;
    }));
  }, []);

  return (
    <>
      <Modal open={open} onClose={onClose} size="lg" className={styles.modal}>
        <Modal.Header>
          <Modal.Title>{isSavedPeopleMode ? 'Load saved people' : 'Add form submission'}</Modal.Title>
        </Modal.Header>
        <Modal.Body className={styles.body}>
          <div className={styles.toolbar}>
            <Input
              value={searchValue}
              onChange={setSearchValue}
              placeholder={isSavedPeopleMode ? 'Search saved people by full name and surname' : 'Search form submissions by full name and surname'}
              className={styles.searchInput}
            />
            <Button appearance="subtle" onClick={() => void loadRecords()} disabled={isLoading}>Refresh</Button>
          </div>
          <div className={styles.helperText}>{isSavedPeopleMode ? <>Click a row to add that saved person as a new node on the map. Edit and delete update the saved people library in the Family Tree app and sync those changes back to Firebase. Current app-state location: <strong>{appStateCollectionName}/{appStateDocumentNames.savedPeople}</strong></> : <>Click a row to add that form submission as a new node on the map. Edit and delete are admin-only Firebase actions. Current Firebase collection: <strong>{collectionName}</strong></>}</div>
          {errorText ? <div className={styles.errorText}>{errorText}</div> : null}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.photoCol}>Photo</th>
                  <th>Full name</th>
                  <th className={styles.actionsCol} aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className={styles.loadingCell}><Loader size="md" content={isSavedPeopleMode ? 'Loading saved people…' : 'Loading Firebase people…'} /></td>
                  </tr>
                ) : null}

                {!isLoading && !paginatedRecords.length ? (
                  <tr>
                    <td colSpan={3} className={styles.emptyCell}>{isSavedPeopleMode ? 'No saved people matched your search.' : 'No form submissions matched your search.'}</td>
                  </tr>
                ) : null}

                {!isLoading && paginatedRecords.map((record) => {
                  const recordName = getRecordName(record) || 'Unnamed person';
                  const photo = getRecordPhoto(record);
                  const recordKey = record.firebaseDocumentId || recordName;
                  const busy = busyRowId === recordKey;

                  return (
                    <tr key={record.firebaseDocumentId || recordName} className={styles.row} onClick={() => handleAddPersonNode(record)}>
                      <td>
                        {photo ? <img src={photo} alt={recordName} className={styles.thumb} /> : <div className={styles.thumbFallback}>No photo</div>}
                      </td>
                      <td>
                        <div className={styles.rowName}>{recordName}</div>
                      </td>
                      <td className={styles.actionsCell} onClick={(event) => event.stopPropagation()}>
                        <Button appearance="subtle" size="xs" className={styles.iconButton} title={isSavedPeopleMode ? 'Edit saved person' : 'Edit person'} aria-label={isSavedPeopleMode ? 'Edit saved person' : 'Edit person'} onClick={(event) => handleEdit(event, record)}>
                          ✎
                        </Button>
                        <Button appearance="subtle" size="xs" color="red" className={styles.iconButton} title={isSavedPeopleMode ? 'Delete saved person' : 'Delete person'} aria-label={isSavedPeopleMode ? 'Delete saved person' : 'Delete person'} disabled={busy} onClick={(event) => void handleDelete(event, record)}>
                          🗑
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.paginationRow}>
            <Pagination
              prev
              next
              first
              last
              layout={['total', '-', 'limit', '|', 'pager']}
              total={filteredRecords.length}
              limitOptions={PAGE_SIZE_OPTIONS}
              activePage={page}
              limit={limit}
              onChangePage={setPage}
              onChangeLimit={(nextLimit) => setLimit(nextLimit)}
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button appearance="subtle" onClick={onClose}>Close</Button>
        </Modal.Footer>
      </Modal>

      <EditFirebasePersonModal
        open={Boolean(editRecord)}
        personRecord={editRecord}
        onClose={() => setEditRecord(null)}
        onUpdated={handleEditSaved}
        sourceMode={mode}
      />
    </>
  );
}
