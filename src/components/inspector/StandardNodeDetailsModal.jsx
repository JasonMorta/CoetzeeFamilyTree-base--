import React, { useMemo } from 'react';
import { Modal, Button } from 'rsuite';
import styles from './StandardNodeDetailsModal.module.css';
import { useAppState } from '../../context/AppStateContext';
import { ACTIONS } from '../../context/appReducer';
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

function LinkValue({ href, children }) {
  if (!hasValue(children)) return null;
  if (!hasValue(href)) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={styles.inlineLink}>
      {children}
    </a>
  );
}

function buildStoryBlocks(person = {}, nodeInfo = {}, hideNodeDetailsFromModule = false) {
  return [
    { label: 'Biography', value: person.biography },
    { label: 'Milestones', value: person.achievements },
    { label: 'Personality', value: person.personality },
    { label: 'Family Notes', value: person.familyNotes },
    { label: 'Notes', value: hideNodeDetailsFromModule ? '' : nodeInfo.notes }
  ].filter((item) => hasValue(item.value));
}

function buildProfileMeta(person = {}, nodeInfo = {}, mapLocation = '', hideNodeDetailsFromModule = false) {
  const items = [];

  if (hasValue(person.birthDate)) {
    items.push({
      key: 'birth',
      label: 'Born',
      value: person.birthDate,
      icon: 'calendar'
    });
  }

  if (person.isAlive === false && hasValue(person.deathDate)) {
    const ageAtDeath = calculateAgeOnDate(person.birthDate, person.deathDate);
    items.push({
      key: 'death',
      label: 'Died',
      value: ageAtDeath != null ? `${person.deathDate} • Age ${ageAtDeath}` : person.deathDate,
      icon: 'calendar-off'
    });
  }

  const locationValue = mapLocation || (!hideNodeDetailsFromModule ? nodeInfo.location : '');
  if (hasValue(locationValue)) {
    items.push({
      key: 'location',
      label: 'Location',
      value: locationValue,
      icon: 'location'
    });
  }

  if (hasValue(person.occupation)) {
    items.push({
      key: 'occupation',
      label: 'Occupation',
      value: person.occupation,
      icon: 'briefcase'
    });
  }

  return items.slice(0, 4);
}

function getRelationshipTypeLabel(groupKey = '', entry = {}) {
  if (hasValue(entry.type)) return entry.type;

  switch (groupKey) {
    case 'parents':
      return 'Parent';
    case 'children':
      return 'Child';
    case 'siblings':
      return 'Sibling';
    case 'partners':
      return 'Spouse';
    default:
      return 'Family';
  }
}

function normalizeRelationshipEntries(groupKey = '', entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && hasValue(entry.name))
    .map((entry, index) => ({
      id: `${groupKey}-${entry.name}-${index}`,
      name: entry.name,
      type: getRelationshipTypeLabel(groupKey, entry),
      photo: entry.photo || '',
      meta: entry.birthDate || ''
    }));
}

function SectionHeading({ children }) {
  return (
    <div className={styles.sectionHeadingWrap}>
      <span className={styles.sectionHeadingLine} />
      <h3 className={styles.sectionHeading}>{children}</h3>
    </div>
  );
}

function Icon({ kind }) {
  switch (kind) {
    case 'calendar':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 2.75a1 1 0 0 1 1 1v1.25h8V3.75a1 1 0 1 1 2 0V5h.75A2.25 2.25 0 0 1 21 7.25v11.5A2.25 2.25 0 0 1 18.75 21H5.25A2.25 2.25 0 0 1 3 18.75V7.25A2.25 2.25 0 0 1 5.25 5H6V3.75a1 1 0 0 1 1-1Zm11.75 8H5v8a.25.25 0 0 0 .25.25h13.5a.25.25 0 0 0 .25-.25v-8ZM18.75 7H5.25a.25.25 0 0 0-.25.25v1.5h14v-1.5a.25.25 0 0 0-.25-.25Z" fill="currentColor"/>
        </svg>
      );
    case 'calendar-off':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.72 3.66a1 1 0 1 0-1.44 1.38L5 6.87v11.88A2.25 2.25 0 0 0 7.25 21h11.31l1.72 1.73a1 1 0 1 0 1.42-1.42l-17-17Zm2.28 5.21 9.13 9.13H7.25a.25.25 0 0 1-.25-.25V8.87Zm10.75 1.88a1 1 0 0 1 1 1v1.5a1 1 0 1 1-2 0v-1.5a1 1 0 0 1 1-1ZM8 3.75a1 1 0 0 0-2 0V5h-.75A2.25 2.25 0 0 0 3 7.25v2.01a1 1 0 1 0 2 0V7.25A.25.25 0 0 1 5.25 7H8.5L17 15.5v3.25a1 1 0 1 0 2 0V7.25A2.25 2.25 0 0 0 16.75 5H16V3.75a1 1 0 1 0-2 0V5H8V3.75Z" fill="currentColor"/>
        </svg>
      );
    case 'location':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.5a7 7 0 0 1 7 7c0 5.08-5.16 10.53-6.35 11.73a.92.92 0 0 1-1.3 0C10.16 20.03 5 14.58 5 9.5a7 7 0 0 1 7-7Zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" fill="currentColor"/>
        </svg>
      );
    case 'briefcase':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 4.75A2.75 2.75 0 0 1 11.75 2h.5A2.75 2.75 0 0 1 15 4.75V6h3.75A2.25 2.25 0 0 1 21 8.25v9.5A2.25 2.25 0 0 1 18.75 20H5.25A2.25 2.25 0 0 1 3 17.75v-9.5A2.25 2.25 0 0 1 5.25 6H9V4.75Zm2 0V6h2V4.75a.75.75 0 0 0-.75-.75h-.5a.75.75 0 0 0-.75.75ZM5.25 8a.25.25 0 0 0-.25.25v2.5h14v-2.5a.25.25 0 0 0-.25-.25H5.25Zm13.75 4.75H5v5a.25.25 0 0 0 .25.25h13.5a.25.25 0 0 0 .25-.25v-5Z" fill="currentColor"/>
        </svg>
      );
    default:
      return null;
  }
}

function ProfileMetaItem({ item }) {
  if (!item) return null;
  const isLocation = item.key === 'location';
  const href = isLocation ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.value)}` : '';

  return (
    <div className={styles.metaRow}>
      <span className={styles.metaIcon}><Icon kind={item.icon} /></span>
      <div className={styles.metaText}>
        <span className={styles.metaLabel}>{item.label}:</span>{' '}
        {isLocation ? <LinkValue href={href}>{item.value}</LinkValue> : <span>{item.value}</span>}
      </div>
    </div>
  );
}

function FamilyCard({ item }) {
  if (!item) return null;

  return (
    <div className={styles.familyCard}>
      {item.photo ? (
        <img className={styles.familyCardImage} src={item.photo} alt={item.name} />
      ) : (
        <div className={styles.familyCardPlaceholder}>{item.name?.charAt(0)?.toUpperCase() || '?'}</div>
      )}
      <div className={styles.familyCardText}>
        <div className={styles.familyCardName}>{item.name}</div>
        {hasValue(item.meta) ? <div className={styles.familyCardMeta}>{item.meta}</div> : null}
        <div className={styles.familyCardType}>{item.type === 'Biological parent' ? 'Parent' : item.type}</div>
      </div>
    </div>
  );
}

function FamilySection({ title, items }) {
  if (!items.length) return null;

  return (
    <section className={styles.familySection}>
      <SectionHeading>{title}</SectionHeading>
      <div className={styles.familyGrid}>
        {items.map((item) => <FamilyCard key={item.id} item={item} />)}
      </div>
    </section>
  );
}

function StoryField({ label, value }) {
  if (!hasValue(value)) return null;

  return (
    <div className={styles.storyField}>
      <div className={styles.storyFieldLabel}>{label}</div>
      <div className={styles.storyText}>{value}</div>
    </div>
  );
}

export default function StandardNodeDetailsModal({ node }) {
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
    const standard = createStandardPersonWrapper(data.standardPerson || {});
    const person = standard.person || {};
    const relationships = standard.person?.relationships || standard.relationships || {};
    const nodeInfo = standard.person?.node || standard.node || {};
    const currentLocation = getRecordCurrentLocation(standard);
    const mapLocation = currentLocation || nodeInfo.location || '';
    const hideNodeDetailsFromModule = Boolean(nodeInfo.hideFromModule || data.hideNodeDetailsFromModule || data.hideFromModule);
    const displayTitle = hideNodeDetailsFromModule
      ? (getRecordName(standard) || nodeInfo.title || 'Profile')
      : (nodeInfo.title || getRecordName(standard) || 'Profile');
    const displayName = getRecordName(standard) || displayTitle || 'Unnamed person';
    const displayHeroImage = hideNodeDetailsFromModule ? (person.photo || nodeInfo.coverImage || '') : (nodeInfo.coverImage || person.photo || '');
    const displaySubtitle = getRecordNickname(standard) || person.prefix || person.occupation || '';
    const displayCaption = !hideNodeDetailsFromModule && hasValue(nodeInfo.imageCaption) ? nodeInfo.imageCaption : '';
    const storyBlocks = buildStoryBlocks(person, nodeInfo, hideNodeDetailsFromModule);
    const metaItems = buildProfileMeta(person, nodeInfo, mapLocation, hideNodeDetailsFromModule);
    const relationshipGroups = {
      parents: normalizeRelationshipEntries('parents', relationships.parents),
      partners: normalizeRelationshipEntries('partners', relationships.partners),
      children: normalizeRelationshipEntries('children', relationships.children),
      siblings: normalizeRelationshipEntries('siblings', relationships.siblings)
    };

    return (
      <div className={styles.profileShell}>
        <div className={styles.profileLeftPane}>
          <div className={styles.profileImageFrame}>
            {displayHeroImage ? <img className={styles.profileImage} src={displayHeroImage} alt={displayName} /> : null}
            <div className={styles.profileImageShade} />
            <div className={styles.profileIdentity}>
              <h2 className={styles.profileName}>{displayName}</h2>
              {hasValue(displaySubtitle) ? <div className={styles.profileSubtitle}>‘{displaySubtitle}’</div> : null}
              {hasValue(displayCaption) ? <div className={styles.profileCaption}>{displayCaption}</div> : null}

              <div className={styles.profileMetaList}>
                {metaItems.map((item) => <ProfileMetaItem key={item.key} item={item} />)}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.profileRightPane}>
          <div className={styles.modalTopBar}>
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

          <div className={styles.rightPaneScroll}>
            {storyBlocks.length ? (
              <section className={styles.storySection}>
                <SectionHeading>Life Story</SectionHeading>
                <div className={styles.storyFields}>
                  {storyBlocks.map((block) => (
                    <StoryField key={block.label} label={block.label} value={block.value} />
                  ))}
                </div>
              </section>
            ) : null}

            <div className={styles.familyColumns}>
              <FamilySection title="Parents" items={relationshipGroups.parents} />
              <FamilySection title="Spouses" items={relationshipGroups.partners} />
              <FamilySection title="Children" items={relationshipGroups.children} />
              <FamilySection title="Siblings" items={relationshipGroups.siblings} />
            </div>

            {!storyBlocks.length && !Object.values(relationshipGroups).some((group) => group.length) ? (
              <div className={styles.emptyText}>No profile details are available for this person yet.</div>
            ) : null}
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
