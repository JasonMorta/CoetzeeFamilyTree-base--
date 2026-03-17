import React from 'react';
import styles from './NodeInspector.module.css';
import { Button } from 'rsuite';
import { useAppState } from '../../context/AppStateContext';
import { ACTIONS } from '../../context/appReducer';
import { createStandardPersonWrapper, getRecordName } from '../../utils/family3Schema';

export default function NodeInspector() {
  const { state, dispatch } = useAppState();
  const node = state.nodes.find((item) => item.id === state.inspectorNodeId);

  if (!node) return null;

  const standard = createStandardPersonWrapper(node.data?.standardPerson || {});

  return (
    <aside className={styles.card}>
      <div className={styles.title}>{standard.node?.title || node.data.title || getRecordName(standard) || 'Untitled Node'}</div>

      {(standard.node?.coverImage || node.data.photo) && (
        <div className={styles.section}>
          <img src={standard.node?.coverImage || node.data.photo} alt={standard.node?.title || node.data.title} style={{ width: '100%', borderRadius: 12 }} />
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.muted}>Photo Caption</div>
        <div>{standard.node?.imageCaption || node.data.photoCaption || '—'}</div>
      </div>

      <div className={styles.section}>
        <div className={styles.muted}>Location / Event Date</div>
        <div>{standard.node?.location || node.data.location || '—'} {(standard.node?.eventDate || node.data.eventDate) ? `• ${standard.node?.eventDate || node.data.eventDate}` : ''}</div>
      </div>

      <div className={styles.section}>
        <div className={styles.muted}>Primary person</div>
        <div><strong>{getRecordName(standard) || 'Unnamed Person'}</strong></div>
        <div>{standard.person?.birthDate || '—'} {standard.person?.deathDate ? `to ${standard.person.deathDate}` : ''}</div>
      </div>

      <div className={styles.section}>
        <div className={styles.muted}>Notes</div>
        <div>{standard.node?.notes || node.data.notes || '—'}</div>
      </div>

      {state.isAdminAuthenticated && (
        <Button appearance="primary" onClick={() => dispatch({ type: ACTIONS.OPEN_EDITOR, payload: node.id })}>
          Edit Node
        </Button>
      )}
    </aside>
  );
}
