import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Loader, Modal, Pagination, Tag } from 'rsuite';
import styles from './FirebasePeopleModal.module.css';
import { useAppState } from '../../context/AppStateContext';
import { ACTIONS } from '../../context/appReducer';
import StandardPersonFields from '../editor/StandardPersonFields';
import { createStandardPersonWrapper, getRecordName, getRecordPhoto, standardPersonToSavedRecord } from '../../utils/family3Schema';
import { applySavedPersonRecordToNodes, upsertSavedPersonRecord } from '../../utils/firebaseLibraryState';
import { saveFirebaseAppStateSnapshot } from '../../services/firebaseAppStateService';
import { deleteFirebaseUpdateRequest, fetchFirebaseUpdateRequests, getFirebaseUpdateRequestsCollectionName, updateFirebaseUpdateRequest } from '../../services/firebaseUpdateRequestService';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function normalizeSearch(value) {
  return String(value || '').trim().toLowerCase();
}

function UpdateRequestEditorModal({ open, requestRecord, onClose, onSaved }) {
  const { state, dispatch } = useAppState();
  const [draftPerson, setDraftPerson] = useState(() => createStandardPersonWrapper(requestRecord?.proposedRecord || {}));
  const [statusText, setStatusText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraftPerson(createStandardPersonWrapper(requestRecord?.proposedRecord || {}));
    setStatusText('');
    setIsSaving(false);
  }, [open, requestRecord]);

  const handleSave = useCallback(async () => {
    if (!requestRecord?.requestId) return;
    setIsSaving(true);
    setStatusText('Saving pending request changes…');
    try {
      const nextRecord = standardPersonToSavedRecord(createStandardPersonWrapper(draftPerson || {}));
      await updateFirebaseUpdateRequest(requestRecord.requestId, {
        ...requestRecord,
        targetPersonName: nextRecord?.person?.name || requestRecord.targetPersonName || '',
        proposedRecord: nextRecord,
        status: requestRecord.status || 'pending'
      });
      setStatusText('Pending request updated.');
      onSaved?.({ ...requestRecord, proposedRecord: nextRecord, targetPersonName: nextRecord?.person?.name || requestRecord.targetPersonName || '' });
      window.setTimeout(() => onClose?.(), 250);
    } catch (error) {
      setStatusText(error?.message || 'Could not save this pending request right now.');
    } finally {
      setIsSaving(false);
    }
  }, [draftPerson, onClose, onSaved, requestRecord]);

  return (
    <Modal open={open} onClose={onClose} size="lg" className={styles.modal}>
      <Modal.Header>
        <Modal.Title>Edit pending update request</Modal.Title>
      </Modal.Header>
      <Modal.Body className={styles.editBody}>
        <div className={styles.editHint}>Review or adjust the proposed person details before you accept the update.</div>
        <StandardPersonFields person={draftPerson} setPerson={setDraftPerson} savedPeople={state.savedPeople} showSectionSaveButtons={false} />
        {statusText ? <div className={styles.statusText}>{statusText}</div> : null}
      </Modal.Body>
      <Modal.Footer>
        <Button appearance="subtle" onClick={onClose} disabled={isSaving}>Cancel</Button>
        <Button appearance="primary" onClick={handleSave} loading={isSaving}>Save request changes</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default function UpdateRequestsModal({ open, onClose, onPendingCountChange }) {
  const { state, dispatch } = useAppState();
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [busyRowId, setBusyRowId] = useState('');
  const [actionStatusText, setActionStatusText] = useState('');
  const [editRecord, setEditRecord] = useState(null);

  const notifyCount = useCallback((items) => {
    onPendingCountChange?.((items || []).filter((item) => item.status === 'pending').length);
  }, [onPendingCountChange]);

  const loadRecords = useCallback(async () => {
    if (!open) return;
    setIsLoading(true);
    setErrorText('');
    try {
      const next = await fetchFirebaseUpdateRequests();
      setRecords(next);
      notifyCount(next);
    } catch (error) {
      setErrorText(error?.message || 'Could not load update requests right now.');
    } finally {
      setIsLoading(false);
    }
  }, [notifyCount, open]);

  useEffect(() => { void loadRecords(); }, [loadRecords]);
  useEffect(() => {
    if (!open) {
      setSearchValue('');
      setPage(1);
      setLimit(10);
      setBusyRowId('');
      setActionStatusText('');
      setEditRecord(null);
    }
  }, [open]);

  const filteredRecords = useMemo(() => {
    const query = normalizeSearch(searchValue);
    const source = Array.isArray(records) ? records : [];
    if (!query) return source;
    return source.filter((record) => {
      const name = normalizeSearch(record.targetPersonName || record.proposedRecord?.person?.name || '');
      const summary = normalizeSearch(record.summary || '');
      const status = normalizeSearch(record.status || '');
      return name.includes(query) || summary.includes(query) || status.includes(query) || normalizeSearch(record.targetPersonId).includes(query);
    });
  }, [records, searchValue]);

  const paginatedRecords = useMemo(() => {
    const start = Math.max(0, (page - 1) * limit);
    return filteredRecords.slice(start, start + limit);
  }, [filteredRecords, limit, page]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredRecords.length / limit));
    if (page > maxPage) setPage(maxPage);
  }, [filteredRecords.length, limit, page]);

  const handleReject = useCallback(async (event, record) => {
    event.stopPropagation();
    if (!record?.requestId) return;
    const confirmed = window.confirm(`Delete the pending update request for ${record.targetPersonName || 'this person'}?`);
    if (!confirmed) return;
    setBusyRowId(record.requestId);
    setActionStatusText(`Deleting the pending request for ${record.targetPersonName || 'this person'}…`);
    try {
      await deleteFirebaseUpdateRequest(record.requestId);
      setRecords((current) => {
        const next = current.filter((item) => item.requestId !== record.requestId);
        notifyCount(next);
        return next;
      });
    } catch (error) {
      setErrorText(error?.message || 'Could not delete that pending request right now.');
    } finally {
      setBusyRowId('');
      setActionStatusText('');
    }
  }, [notifyCount]);

  const handleAccept = useCallback(async (event, record) => {
    event.stopPropagation();
    if (!record?.requestId || !record?.targetPersonId || !record?.proposedRecord) return;
    setBusyRowId(record.requestId);
    setActionStatusText(`Applying the approved update for ${record.targetPersonName || 'this person'}…`);
    setErrorText('');
    try {
      const savedRecord = standardPersonToSavedRecord(createStandardPersonWrapper({
        ...(record.originalRecord || {}),
        ...(record.proposedRecord || {}),
        firebaseDocumentId: record.targetPersonId,
        person: {
          ...(record.originalRecord?.person || {}),
          ...(record.proposedRecord?.person || {}),
          node: record.originalRecord?.person?.node || record.proposedRecord?.person?.node || {},
          submissionMeta: {
            ...(record.originalRecord?.person?.submissionMeta || {}),
            ...(record.proposedRecord?.person?.submissionMeta || {}),
            status: 'approved',
            updatedAt: new Date().toISOString()
          }
        }
      }));

      const nextSavedPeople = upsertSavedPersonRecord(state.savedPeople, savedRecord);
      const nextNodes = applySavedPersonRecordToNodes(state.nodes, savedRecord);
      await saveFirebaseAppStateSnapshot({
        nodes: nextNodes,
        edges: state.edges,
        viewport: state.viewport,
        appSettings: state.appSettings,
        savedPeople: nextSavedPeople
      });
      await deleteFirebaseUpdateRequest(record.requestId);
      dispatch({ type: ACTIONS.SET_SAVED_PEOPLE, payload: nextSavedPeople });
      dispatch({ type: ACTIONS.SET_NODES, payload: nextNodes });
      setRecords((current) => {
        const next = current.filter((item) => item.requestId !== record.requestId);
        notifyCount(next);
        return next;
      });
    } catch (error) {
      setErrorText(error?.message || 'Could not accept that update request right now.');
    } finally {
      setBusyRowId('');
      setActionStatusText('');
    }
  }, [dispatch, notifyCount, state.appSettings, state.edges, state.nodes, state.savedPeople, state.viewport]);

  const handleEditSaved = useCallback((updatedRecord) => {
    setRecords((current) => current.map((item) => item.requestId === updatedRecord.requestId ? updatedRecord : item));
  }, []);

  if (!state.isAdminAuthenticated) return null;

  return (
    <>
      <Modal open={open} onClose={onClose} size="lg" className={styles.modal}>
        <Modal.Header>
          <Modal.Title>Update requests</Modal.Title>
        </Modal.Header>
        <Modal.Body className={styles.body}>
          <div className={styles.helperText}>
            Pending review queue from <strong>{getFirebaseUpdateRequestsCollectionName()}</strong>. Accepting a request updates the saved person library and writes a fresh app snapshot.
          </div>
          <div className={styles.toolbar}>
            <Input value={searchValue} onChange={setSearchValue} className={styles.searchInput} placeholder="Search pending requests" />
            <Button appearance="ghost" onClick={() => void loadRecords()} disabled={isLoading}>Refresh</Button>
          </div>
          {actionStatusText ? <div className={styles.progressNotice}><Loader size="sm" vertical={false} content={actionStatusText} /></div> : null}
          {errorText ? <div className={styles.errorText}>{errorText}</div> : null}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Photo</th>
                  <th>Name</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5}><div className={styles.loadingCell}><Loader content="Loading update requests…" /></div></td></tr>
                ) : paginatedRecords.length === 0 ? (
                  <tr><td colSpan={5}><div className={styles.emptyState}>No update requests found.</div></td></tr>
                ) : paginatedRecords.map((record) => {
                  const busy = busyRowId === record.requestId;
                  const photo = getRecordPhoto(record.proposedRecord || {});
                  const recordName = getRecordName(record.proposedRecord || {}) || record.targetPersonName || 'Unnamed person';
                  return (
                    <tr key={record.requestId} className={styles.tableRow} onClick={() => !busy && setEditRecord(record)}>
                      <td><Tag color={record.status === 'pending' ? 'red' : 'green'}>{record.status || 'pending'}</Tag></td>
                      <td>{photo ? <img src={photo} alt={recordName} className={styles.thumb} /> : <div className={styles.thumbFallback}>No photo</div>}</td>
                      <td><div className={styles.rowName}>{recordName}</div><div className={styles.rowMeta}>{record.targetPersonId}</div></td>
                      <td>{record.submittedAt ? new Date(record.submittedAt).toLocaleString() : '—'}</td>
                      <td className={styles.actionsCell} onClick={(event) => event.stopPropagation()}>
                        <Button appearance="subtle" size="xs" className={styles.iconButton} title="Edit request" onClick={(event) => { event.stopPropagation(); setEditRecord(record); }}>✎</Button>
                        <Button appearance="subtle" size="xs" color="green" className={styles.iconButton} disabled={busy} title="Accept update" onClick={(event) => void handleAccept(event, record)}>{busy ? '…' : '✓'}</Button>
                        <Button appearance="subtle" size="xs" color="red" className={styles.iconButton} disabled={busy} title="Delete request" onClick={(event) => void handleReject(event, record)}>{busy ? '…' : '🗑'}</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.paginationRow}>
            <Pagination prev next first last layout={['total', '-', 'limit', '|', 'pager']} total={filteredRecords.length} limitOptions={PAGE_SIZE_OPTIONS} activePage={page} limit={limit} onChangePage={setPage} onChangeLimit={(nextLimit) => setLimit(nextLimit)} />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button appearance="subtle" onClick={onClose}>Close</Button>
        </Modal.Footer>
      </Modal>
      <UpdateRequestEditorModal open={Boolean(editRecord)} requestRecord={editRecord} onClose={() => setEditRecord(null)} onSaved={handleEditSaved} />
    </>
  );
}
