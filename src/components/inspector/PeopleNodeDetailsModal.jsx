import React, { useMemo } from 'react';
import { Modal, Button } from 'rsuite';
import styles from './PeopleNodeDetailsModal.module.css';
import { useAppState } from '../../context/AppStateContext';
import { ACTIONS } from '../../context/appReducer';

function hasValue(value) {
  return !(value == null || String(value).trim() === '');
}

function PersonPill({ person, index }) {
  const name = person?.fullName || 'Unnamed person';
  const nickname = person?.nickname || '';
  const photo = person?.photo || '';
  const key = person?.id || `${name}-${index}`;

  return (
    <div className={styles.personPill} key={key}>
      {photo ? (
        <img className={styles.personPillImage} src={photo} alt={name} />
      ) : (
        <div className={styles.personPillPlaceholder}>{name.charAt(0)?.toUpperCase() || '?'}</div>
      )}
      <div className={styles.personPillText}>
        <div className={styles.personPillName}>{name}</div>
        <div className={styles.personPillMeta}>{hasValue(nickname) ? nickname : 'Family member'}</div>
      </div>
    </div>
  );
}

export default function PeopleNodeDetailsModal({ node }) {
  const { state, dispatch } = useAppState();

  const close = () => {
    dispatch({ type: ACTIONS.CLOSE_NODE_MODAL });
  };

  const handleEdit = () => {
    if (!node) return;
    dispatch({ type: ACTIONS.OPEN_EDITOR, payload: node.id });
    dispatch({ type: ACTIONS.CLOSE_NODE_MODAL });
  };

  const content = useMemo(() => {
    if (!node) return null;
    const data = node.data || {};
    const people = Array.isArray(data.people) ? data.people.filter((person) => hasValue(person?.fullName)) : [];
    const title = data.peopleNodeSingleImageTitle || data.title || 'Family members';
    const caption = data.photoCaption || data.notes || '';
    const heroImage = data.peopleNodeSingleImageUrl || '';

    return (
      <div className={styles.peopleShell}>
        <div className={styles.topBar}>
          <div className={styles.topBarSpacer} />
          <div className={styles.topBarActions}>
            {state.isAdminAuthenticated ? (
              <Button appearance="primary" className={styles.editButton} onClick={handleEdit}>
                Edit Profile
              </Button>
            ) : null}
            <button type="button" className={styles.closeButton} onClick={close} aria-label="Close preview">
              <span />
              <span />
            </button>
          </div>
        </div>

        <div className={styles.peopleScroll}>
          <div className={styles.heroCard}>
            <div className={styles.heroMediaWrap}>
              {heroImage ? (
                <img className={styles.heroMedia} src={heroImage} alt={title} />
              ) : (
                <div className={styles.heroMediaPlaceholder}>No display image</div>
              )}
              <div className={styles.heroShade} />
              <div className={styles.heroText}>
                <h2 className={styles.heroTitle}>{title}</h2>
                {hasValue(caption) ? <p className={styles.heroCaption}>{caption}</p> : null}
              </div>
            </div>
          </div>

          <div className={styles.peopleSection}>
            {people.length ? (
              <div className={styles.peopleList}>
                {people.map((person, index) => <PersonPill key={person?.id || `${person?.fullName || 'person'}-${index}`} person={person} index={index} />)}
              </div>
            ) : (
              <div className={styles.emptyText}>No family members are available for this group yet.</div>
            )}
          </div>
        </div>
      </div>
    );
  }, [node, state.isAdminAuthenticated]);

  if (!node) return null;

  return (
    <Modal open={state.isNodeModalOpen} onClose={close} size="lg" className={styles.modal}>
      <Modal.Body className={styles.body}>{content}</Modal.Body>
    </Modal>
  );
}
