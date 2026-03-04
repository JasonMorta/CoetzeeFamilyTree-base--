import React from 'react';
import styles from './NodeInspector.module.css';
import { Button } from 'rsuite';
import { useAppState } from '../../context/AppStateContext';
import { ACTIONS } from '../../context/appReducer';

export default function NodeInspector() {
  const { state, dispatch } = useAppState();
  const node = state.nodes.find((item) => item.id === state.inspectorNodeId);

  if (!node) {
    return null;
  }

  return (
    <aside className={styles.card}>
      <div className={styles.title}>{node.data.title || 'Untitled Node'}</div>

      {node.data.photo && (
        <div className={styles.section}>
          <img src={node.data.photo} alt={node.data.title} style={{ width: '100%', borderRadius: 12 }} />
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.muted}>Photo Caption</div>
        <div>{node.data.photoCaption || '—'}</div>
      </div>

      <div className={styles.section}>
        <div className={styles.muted}>Location / Event Date</div>
        <div>{node.data.location || '—'} {node.data.eventDate ? `• ${node.data.eventDate}` : ''}</div>
      </div>

      <div className={styles.section}>
        <div className={styles.muted}>People</div>
        {(node.data.people || []).map((person) => (
          <div className={styles.person} key={person.id}>
            <strong>{person.fullName || 'Unnamed Person'}</strong><br />
            <span className={styles.muted}>{person.relationLabel || 'No relation label'}</span><br />
            <span>{person.birthDate || '—'} {person.deathDate ? `to ${person.deathDate}` : ''}</span>
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.muted}>Notes</div>
        <div>{node.data.notes || '—'}</div>
      </div>

      {state.isAdminAuthenticated && (
        <Button appearance="primary" onClick={() => dispatch({ type: ACTIONS.OPEN_EDITOR, payload: node.id })}>
          Edit Node
        </Button>
      )}
    </aside>
  );
}
