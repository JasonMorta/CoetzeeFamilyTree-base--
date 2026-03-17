import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Button, Divider } from 'rsuite';
import styles from './NodeDetailsModal.module.css';
import { useAppState } from '../../context/AppStateContext';
import { ACTIONS } from '../../context/appReducer';
import { NODE_TYPES } from '../../utils/nodeFactory';
import { createStandardPersonWrapper, getRecordCurrentLocation, getRecordName, getRecordNickname } from '../../utils/family3Schema';

function hasValue(value) {
  return !(value == null || String(value).trim() === '');
}

function calculateAgeOnDate(birthDate, endDate) {
  if (!birthDate || !endDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(end.getTime()) || end < birth) return null;
  let age = end.getFullYear() - birth.getFullYear();
  const monthDelta = end.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && end.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function calculateCurrentAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return calculateAgeOnDate(birthDate, `${yyyy}-${mm}-${dd}`);
}

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    if (!hasValue(value) || !navigator?.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }, [value]);

  if (!hasValue(value)) return null;

  return (
    <Button
      size="xs"
      appearance="subtle"
      className={styles.copyButton}
      onClick={handleCopy}
      title={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

function FieldLine({ label, children, action = null }) {
  return (
    <div className={styles.fieldLine}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.fieldValueRow}>
        <div className={styles.fieldValue}>{children || <span className={styles.emptyValue}>—</span>}</div>
        {action}
      </div>
    </div>
  );
}

function LinkValue({ href, children }) {
  if (!hasValue(children) || !hasValue(href)) {
    return children || null;
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className={styles.fieldLink}>
      {children}
    </a>
  );
}

function RelationshipTile({ entry }) {
  if (!entry?.name) return null;
  return (
    <div className={styles.relTile}>
      {entry.photo ? <img className={styles.relImg} src={entry.photo} alt={entry.name} /> : <div className={styles.relImgPlaceholder}>No image</div>}
      <div className={styles.relType}>{entry.type || 'Relationship'}</div>
      <div className={styles.relName}>{entry.name}</div>
      {entry.birthDate ? <div className={styles.relMeta}>{entry.birthDate}</div> : null}
    </div>
  );
}

function RelationshipSection({ title, entries }) {
  const list = Array.isArray(entries) ? entries.filter((entry) => entry?.name) : [];
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      {list.length ? <div className={styles.relList}>{list.map((entry, index) => <RelationshipTile key={`${title}-${entry.name}-${index}`} entry={entry} />)}</div> : <div className={styles.emptyState}>No {title.toLowerCase()} added yet.</div>}
    </div>
  );
}

export default function NodeDetailsModal() {
  const { state, dispatch } = useAppState();
  const node = state.nodes.find((item) => item.id === state.activeNodeId);

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
    const nodeType = data.nodeType || NODE_TYPES.STANDARD;

    if (nodeType === NODE_TYPES.PERSONS) {
      const people = Array.isArray(data.people) ? data.people : [];
      const showSingleImage = Boolean(data.peopleNodeDisplaySingleImage && data.peopleNodeSingleImageUrl);
      const singleImageTitle = data.peopleNodeSingleImageTitle || data.title || 'Persons node';
      return (
        <>
          <div className={styles.title}>{showSingleImage ? singleImageTitle : data.title || 'Persons node'}</div>
          {data.photoCaption ? <div className={styles.caption}>{data.photoCaption}</div> : null}

          {showSingleImage ? (
            <div className={styles.peopleHeroWrap}>
              <img
                className={styles.peopleHeroImage}
                src={data.peopleNodeSingleImageUrl}
                alt={singleImageTitle || 'Persons node image'}
              />
            </div>
          ) : null}

          <Divider />
          <div className={styles.peopleGridList}>
            {people.map((p) => (
              <div key={p.id} className={styles.personGridCard}>
                {p.photo ? <img className={styles.personGridThumb} src={p.photo} alt={p.fullName || 'Person'} /> : <div className={styles.personGridThumbFallback}>?</div>}
                <div className={styles.personGridName}>{p.fullName || 'Unnamed person'}</div>
                {p.nickname ? <div className={styles.personGridNick}>{p.nickname}</div> : null}
              </div>
            ))}
            {!people.length ? <div className={styles.emptyState}>No people added yet.</div> : null}
          </div>
        </>
      );
    }

    const standard = createStandardPersonWrapper(data.standardPerson || {});
    const person = standard.person || {};
    const relationships = standard.person?.relationships || standard.relationships || {};
    const nodeInfo = standard.person?.node || standard.node || {};
    const currentLocation = getRecordCurrentLocation(standard);
    const mapLocation = currentLocation || nodeInfo.location || '';
    const contactNumber = person.contactNumber || '';
    const showMaidenName = hasValue(person.maidenName) && (!hasValue(person.gender) || person.gender === 'Female');
    const currentAge = person.isAlive === true ? calculateCurrentAge(person.birthDate) : null;
    const ageAtDeath = person.isAlive === false ? calculateAgeOnDate(person.birthDate, person.deathDate) : null;

    return (
      <>
        <div className={styles.title}>{nodeInfo.title || getRecordName(standard) || 'Person details'}</div>
        {nodeInfo.imageCaption ? <div className={styles.caption}>{nodeInfo.imageCaption}</div> : null}

        <div className={styles.hero}>
          {nodeInfo.coverImage ? <img className={styles.heroImg} src={nodeInfo.coverImage} alt={nodeInfo.title || getRecordName(standard) || 'Person'} /> : <div className={styles.heroFallback}>No image</div>}
          <div className={styles.heroMeta}>
            <div className={styles.heroName}>{getRecordName(standard) || 'Unnamed person'}</div>
            {getRecordNickname(standard) ? <div className={styles.heroNick}>{getRecordNickname(standard)}</div> : null}
            <div className={styles.heroBadges}>
              {nodeInfo.eventDate ? <span className={styles.badge}>{nodeInfo.eventDate}</span> : (person.birthDate ? <span className={styles.badge}>{person.birthDate}</span> : null)}
              <span className={styles.badge}>{person.isAlive === true ? 'Living' : person.isAlive === false ? 'Passed away' : 'Life status unknown'}</span>
              {nodeInfo.location ? <span className={styles.badge}>{nodeInfo.location}</span> : null}
            </div>
          </div>
        </div>

        <Divider />
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Person details</div>
          <FieldLine label="Full name">{person.name}</FieldLine>
          <FieldLine label="Birth date">{person.birthDate}</FieldLine>
          {currentAge != null ? <FieldLine label="Current age">{String(currentAge)}</FieldLine> : null}
          <FieldLine label="Nickname">{person.nickname}</FieldLine>
          <FieldLine label="Title or prefix">{person.prefix}</FieldLine>
          {showMaidenName ? <FieldLine label="Maiden name">{person.maidenName}</FieldLine> : null}
          <FieldLine label="Gender">{person.gender}</FieldLine>
          <FieldLine label="Birth place">{person.birthPlace}</FieldLine>
          <FieldLine
            label="Current location"
            action={<CopyButton value={mapLocation} label="Current location" />}
          >
            <LinkValue href={mapLocation ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapLocation)}` : ''}>{mapLocation}</LinkValue>
          </FieldLine>
          <FieldLine
            label="Contact number"
            action={<CopyButton value={contactNumber} label="Phone number" />}
          >
            <LinkValue href={contactNumber ? `tel:${String(contactNumber).replace(/\s+/g, '')}` : ''}>{contactNumber}</LinkValue>
          </FieldLine>
          <FieldLine label="Heritage">{person.heritage}</FieldLine>
          <FieldLine label="Occupation">{person.occupation}</FieldLine>
          <FieldLine label="Education">{person.education}</FieldLine>
          <FieldLine label="Marital status">{person.maritalStatus}</FieldLine>
          <FieldLine label="Languages">{person.languages}</FieldLine>
          {person.isAlive === false ? <FieldLine label="Death date">{person.deathDate}</FieldLine> : null}
          {person.isAlive === false ? <FieldLine label="Death place">{person.deathPlace}</FieldLine> : null}
          {ageAtDeath != null ? <FieldLine label="Died at age">{String(ageAtDeath)}</FieldLine> : null}
          <FieldLine label="Biography"><div className={styles.preWrap}>{person.biography}</div></FieldLine>
          <FieldLine label="Achievements"><div className={styles.preWrap}>{person.achievements}</div></FieldLine>
          <FieldLine label="Interests"><div className={styles.preWrap}>{person.interests}</div></FieldLine>
          <FieldLine label="Personality"><div className={styles.preWrap}>{person.personality}</div></FieldLine>
          <FieldLine label="Family notes"><div className={styles.preWrap}>{person.familyNotes}</div></FieldLine>
        </div>

        <Divider />
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Node details</div>
          <FieldLine label="Node title">{nodeInfo.title}</FieldLine>
          <FieldLine label="Image caption">{nodeInfo.imageCaption}</FieldLine>
          <FieldLine label="Event date">{nodeInfo.eventDate}</FieldLine>
          <FieldLine
            label="Location"
            action={<CopyButton value={nodeInfo.location} label="Location" />}
          >
            <LinkValue href={nodeInfo.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nodeInfo.location)}` : ''}>{nodeInfo.location}</LinkValue>
          </FieldLine>
          <FieldLine label="Notes"><div className={styles.preWrap}>{nodeInfo.notes}</div></FieldLine>
        </div>

        <Divider />
        <RelationshipSection title="Parents" entries={relationships.parents} />
        <RelationshipSection title="Children" entries={relationships.children} />
        <RelationshipSection title="Siblings" entries={relationships.siblings} />
        <RelationshipSection title="Partners" entries={relationships.partners} />
      </>
    );
  }, [node]);

  if (!state.isNodeModalOpen || !node) return null;

  return (
    <Modal open={state.isNodeModalOpen} onClose={close} size="md" className={styles.modal}>
      <Modal.Header>
        <Modal.Title>Node details</Modal.Title>
      </Modal.Header>
      <Modal.Body className={styles.body}>{content}</Modal.Body>
      <Modal.Footer>
        {state.isAdminAuthenticated ? <Button appearance="ghost" onClick={handleEdit}>Edit Node</Button> : null}
        <Button onClick={close} appearance="primary">Close</Button>
      </Modal.Footer>
    </Modal>
  );
}
