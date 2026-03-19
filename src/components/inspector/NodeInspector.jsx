import React from 'react';
import styles from './NodeInspector.module.css';
import { Button } from 'rsuite';
import { useAppState } from '../../context/AppStateContext';
import { ACTIONS } from '../../context/appReducer';
import { createStandardPersonWrapper, getRecordName, getRecordPhoto } from '../../utils/family3Schema';

function hasValue(value) {
  return !(value == null || String(value).trim() === '');
}

export default function NodeInspector() {
  const { state, dispatch } = useAppState();
  const node = state.nodes.find((item) => item.id === state.inspectorNodeId);

  if (!node) return null;

  const standard = createStandardPersonWrapper(node.data?.standardPerson || {});
  const hideNodeDetailsFromModule = Boolean(standard.node?.hideFromModule || node.data?.hideNodeDetailsFromModule || node.data?.hideFromModule);
  const displayTitle = hideNodeDetailsFromModule ? (getRecordName(standard) || standard.node?.title || node.data.title || 'Untitled Node') : (standard.node?.title || node.data.title || getRecordName(standard) || 'Untitled Node');
  const displayImage = hideNodeDetailsFromModule ? (getRecordPhoto(standard) || standard.node?.coverImage || node.data.photo) : (standard.node?.coverImage || node.data.photo || getRecordPhoto(standard));
  const imageCaption = standard.node?.imageCaption || node.data.photoCaption || '';
  const location = standard.node?.location || node.data.location || '';
  const eventDate = standard.node?.eventDate || node.data.eventDate || '';
  const notes = standard.node?.notes || node.data.notes || '';
  const primaryPersonName = getRecordName(standard) || '';
  const primaryPersonDates = [standard.person?.birthDate || '', standard.person?.deathDate ? `to ${standard.person.deathDate}` : ''].filter(Boolean).join(' ');

  return (
    <aside className={styles.card}>
      <div className={styles.title}>{displayTitle}</div>

      {displayImage ? (
        <div className={styles.section}>
          <img src={displayImage} alt={displayTitle} style={{ width: '100%', borderRadius: 12 }} />
        </div>
      ) : null}

      {!hideNodeDetailsFromModule && hasValue(imageCaption) ? (
        <div className={styles.section}>
          <div className={styles.muted}>Photo Caption</div>
          <div>{imageCaption}</div>
        </div>
      ) : null}

      {!hideNodeDetailsFromModule && (hasValue(location) || hasValue(eventDate)) ? (
        <div className={styles.section}>
          <div className={styles.muted}>Location / Event Date</div>
          <div>{[location, eventDate].filter(Boolean).join(' • ')}</div>
        </div>
      ) : null}

      {(hasValue(primaryPersonName) || hasValue(primaryPersonDates)) ? (
        <div className={styles.section}>
          <div className={styles.muted}>Primary person</div>
          {hasValue(primaryPersonName) ? <div><strong>{primaryPersonName}</strong></div> : null}
          {hasValue(primaryPersonDates) ? <div>{primaryPersonDates}</div> : null}
        </div>
      ) : null}

      {!hideNodeDetailsFromModule && hasValue(notes) ? (
        <div className={styles.section}>
          <div className={styles.muted}>Notes</div>
          <div>{notes}</div>
        </div>
      ) : null}

      {state.isAdminAuthenticated && (
        <Button appearance="primary" onClick={() => dispatch({ type: ACTIONS.OPEN_EDITOR, payload: node.id })}>
          Edit Node
        </Button>
      )}
    </aside>
  );
}
