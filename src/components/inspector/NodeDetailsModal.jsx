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
  if (!hasValue(children) && !React.isValidElement(children)) return null;

  return (
    <div className={styles.fieldLine}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.fieldValueRow}>
        <div className={styles.fieldValue}>{children}</div>
        {action}
      </div>
    </div>
  );
}

function buildSectionRows(rows = []) {
  return rows.filter(Boolean);
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
  if (!list.length) return null;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      <div className={styles.relList}>{list.map((entry, index) => <RelationshipTile key={`${title}-${entry.name}-${index}`} entry={entry} />)}</div>
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

          {people.length ? (
            <>
              <Divider />
              <div className={styles.peopleGridList}>
                {people.map((p) => (
                  <div key={p.id} className={styles.personGridCard}>
                    {p.photo ? <img className={styles.personGridThumb} src={p.photo} alt={p.fullName || 'Person'} /> : <div className={styles.personGridThumbFallback}>?</div>}
                    <div className={styles.personGridName}>{p.fullName || 'Unnamed person'}</div>
                    {p.nickname ? <div className={styles.personGridNick}>{p.nickname}</div> : null}
                  </div>
                ))}
              </div>
            </>
          ) : null}
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
    const hideNodeDetailsFromModule = Boolean(nodeInfo.hideFromModule || data.hideNodeDetailsFromModule || data.hideFromModule);
    const displayTitle = hideNodeDetailsFromModule ? (getRecordName(standard) || nodeInfo.title || 'Person details') : (nodeInfo.title || getRecordName(standard) || 'Person details');
    const displayHeroImage = hideNodeDetailsFromModule ? (person.photo || nodeInfo.coverImage || '') : (nodeInfo.coverImage || person.photo || '');

    const personRows = buildSectionRows([
      hasValue(person.name) ? <FieldLine key="name" label="Full name">{person.name}</FieldLine> : null,
      hasValue(person.birthDate) ? <FieldLine key="birthDate" label="Birth date">{person.birthDate}</FieldLine> : null,
      currentAge != null ? <FieldLine key="currentAge" label="Current age">{String(currentAge)}</FieldLine> : null,
      hasValue(person.nickname) ? <FieldLine key="nickname" label="Nickname">{person.nickname}</FieldLine> : null,
      hasValue(person.prefix) ? <FieldLine key="prefix" label="Title or prefix">{person.prefix}</FieldLine> : null,
      showMaidenName ? <FieldLine key="maidenName" label="Maiden name">{person.maidenName}</FieldLine> : null,
      hasValue(person.gender) ? <FieldLine key="gender" label="Gender">{person.gender}</FieldLine> : null,
      hasValue(person.birthPlace) ? <FieldLine key="birthPlace" label="Birth place">{person.birthPlace}</FieldLine> : null,
      hasValue(mapLocation) ? (
        <FieldLine
          key="currentLocation"
          label="Current location"
          action={<CopyButton value={mapLocation} label="Current location" />}
        >
          <LinkValue href={mapLocation ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapLocation)}` : ''}>{mapLocation}</LinkValue>
        </FieldLine>
      ) : null,
      hasValue(contactNumber) ? (
        <FieldLine
          key="contactNumber"
          label="Contact number"
          action={<CopyButton value={contactNumber} label="Phone number" />}
        >
          <LinkValue href={contactNumber ? `tel:${String(contactNumber).replace(/\s+/g, '')}` : ''}>{contactNumber}</LinkValue>
        </FieldLine>
      ) : null,
      hasValue(person.heritage) ? <FieldLine key="heritage" label="Heritage">{person.heritage}</FieldLine> : null,
      hasValue(person.occupation) ? <FieldLine key="occupation" label="Occupation">{person.occupation}</FieldLine> : null,
      hasValue(person.education) ? <FieldLine key="education" label="Education">{person.education}</FieldLine> : null,
      hasValue(person.maritalStatus) ? <FieldLine key="maritalStatus" label="Marital status">{person.maritalStatus}</FieldLine> : null,
      hasValue(person.languages) ? <FieldLine key="languages" label="Languages">{person.languages}</FieldLine> : null,
      person.isAlive === false && hasValue(person.deathDate) ? <FieldLine key="deathDate" label="Death date">{person.deathDate}</FieldLine> : null,
      person.isAlive === false && hasValue(person.deathPlace) ? <FieldLine key="deathPlace" label="Death place">{person.deathPlace}</FieldLine> : null,
      ageAtDeath != null ? <FieldLine key="ageAtDeath" label="Died at age">{String(ageAtDeath)}</FieldLine> : null,
      hasValue(person.biography) ? <FieldLine key="biography" label="Biography"><div className={styles.preWrap}>{person.biography}</div></FieldLine> : null,
      hasValue(person.achievements) ? <FieldLine key="achievements" label="Achievements"><div className={styles.preWrap}>{person.achievements}</div></FieldLine> : null,
      hasValue(person.interests) ? <FieldLine key="interests" label="Interests"><div className={styles.preWrap}>{person.interests}</div></FieldLine> : null,
      hasValue(person.personality) ? <FieldLine key="personality" label="Personality"><div className={styles.preWrap}>{person.personality}</div></FieldLine> : null,
      hasValue(person.familyNotes) ? <FieldLine key="familyNotes" label="Family notes"><div className={styles.preWrap}>{person.familyNotes}</div></FieldLine> : null
    ]);

    const nodeRows = hideNodeDetailsFromModule
      ? []
      : buildSectionRows([
        hasValue(nodeInfo.title) ? <FieldLine key="title" label="Node title">{nodeInfo.title}</FieldLine> : null,
        hasValue(nodeInfo.imageCaption) ? <FieldLine key="imageCaption" label="Image caption">{nodeInfo.imageCaption}</FieldLine> : null,
        hasValue(nodeInfo.eventDate) ? <FieldLine key="eventDate" label="Event date">{nodeInfo.eventDate}</FieldLine> : null,
        hasValue(nodeInfo.location) ? (
          <FieldLine
            key="location"
            label="Location"
            action={<CopyButton value={nodeInfo.location} label="Location" />}
          >
            <LinkValue href={nodeInfo.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nodeInfo.location)}` : ''}>{nodeInfo.location}</LinkValue>
          </FieldLine>
        ) : null,
        hasValue(nodeInfo.notes) ? <FieldLine key="notes" label="Notes"><div className={styles.preWrap}>{nodeInfo.notes}</div></FieldLine> : null
      ]);

    const hasRelationshipEntries = ['parents', 'children', 'siblings', 'partners'].some((groupKey) => Array.isArray(relationships?.[groupKey]) && relationships[groupKey].some((entry) => entry?.name));

    return (
      <>
        <div className={styles.title}>{displayTitle}</div>
        {!hideNodeDetailsFromModule && hasValue(nodeInfo.imageCaption) ? <div className={styles.caption}>{nodeInfo.imageCaption}</div> : null}

        {(displayHeroImage || hasValue(getRecordName(standard)) || hasValue(getRecordNickname(standard)) || hasValue(nodeInfo.eventDate) || hasValue(person.birthDate) || hasValue(nodeInfo.location) || hasValue(person.isAlive)) ? (
          <div className={styles.hero}>
            {displayHeroImage ? <img className={styles.heroImg} src={displayHeroImage} alt={displayTitle || getRecordName(standard) || 'Person'} /> : null}
            <div className={styles.heroMeta}>
              {hasValue(getRecordName(standard)) ? <div className={styles.heroName}>{getRecordName(standard)}</div> : null}
              {getRecordNickname(standard) ? <div className={styles.heroNick}>{getRecordNickname(standard)}</div> : null}
              <div className={styles.heroBadges}>
                {!hideNodeDetailsFromModule ? (nodeInfo.eventDate ? <span className={styles.badge}>{nodeInfo.eventDate}</span> : (person.birthDate ? <span className={styles.badge}>{person.birthDate}</span> : null)) : (person.birthDate ? <span className={styles.badge}>{person.birthDate}</span> : null)}
                {hasValue(person.isAlive) ? <span className={styles.badge}>{person.isAlive === true ? 'Living' : person.isAlive === false ? 'Passed away' : 'Life status unknown'}</span> : null}
                {!hideNodeDetailsFromModule && nodeInfo.location ? <span className={styles.badge}>{nodeInfo.location}</span> : null}
              </div>
            </div>
          </div>
        ) : null}

        {personRows.length ? (
          <>
            <Divider />
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Person details</div>
              {personRows}
            </div>
          </>
        ) : null}

        {nodeRows.length ? (
          <>
            <Divider />
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Node details</div>
              {nodeRows}
            </div>
          </>
        ) : null}

        {hasRelationshipEntries ? (
          <>
            <Divider />
            <RelationshipSection title="Parents" entries={relationships.parents} />
            <RelationshipSection title="Children" entries={relationships.children} />
            <RelationshipSection title="Siblings" entries={relationships.siblings} />
            <RelationshipSection title="Partners" entries={relationships.partners} />
          </>
        ) : null}
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
