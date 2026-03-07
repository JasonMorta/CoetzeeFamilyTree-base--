import React, { useMemo, useState, useCallback } from 'react';
import { Modal, Button, Divider } from 'rsuite';
import styles from './NodeDetailsModal.module.css';
import { useAppState } from '../../context/AppStateContext';
import { ACTIONS } from '../../context/appReducer';
import { NODE_TYPES } from '../../utils/nodeFactory';

function isHidden(person, field) {
  return !!(person?.hiddenFields && person.hiddenFields[field]);
}

function placeholderFor(field) {
  const placeholders = {
    fullName: 'Unknown',
    photo: 'No image provided',
    nickname: 'Unknown',
    prefix: 'Unknown',
    maidenName: 'Unknown',
    birthDate: 'Unknown',
    birthPlace: 'Unknown',
    deathDate: 'Unknown',
    deathPlace: 'Unknown',
    occupation: 'Unknown',
    address: 'No address provided',
    contactNumber: 'No contact number provided',
    father: 'Unknown',
    mother: 'Unknown',
    children: 'None listed',
    siblings: 'None listed',
    girlfriends: 'None listed',
    boyfriends: 'None listed',
    husbands: 'None listed',
    wives: 'None listed',
    stepFathers: 'None listed',
    stepMothers: 'None listed',
    fosterParents: 'None listed',
    fosterChildren: 'None listed',
    adoptiveParents: 'None listed',
    adoptedChildren: 'None listed',
    moreInfo: 'No information yet'
  };
  return placeholders[field] || 'Unknown';
}

function displayValue(person, field) {
  const v = person?.[field];

  const multiRelFields = new Set(['children','siblings','girlfriends','boyfriends','husbands','wives','stepFathers','stepMothers','fosterParents','fosterChildren','adoptiveParents','adoptedChildren']);
  if (multiRelFields.has(field)) {
    return Array.isArray(v) ? v : [];
  }

  if (v === null || v === undefined || String(v).trim() === '') {
    return placeholderFor(field);
  }

  return v;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
}

function MapLinkButton({ address }) {
  const query = encodeURIComponent(address || '');
  const href = `https://www.google.com/maps/search/?api=1&query=${query}`;

  return (
    <a className={styles.mapLink} href={href} target="_blank" rel="noreferrer">
      📍
    </a>
  );
}

function FieldLine({ label, children }) {
  return (
    <div className={styles.fieldLine}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.fieldValue}>{children}</div>
    </div>
  );
}

function RelationshipThumb({ name, photo }) {
  if (!name) return null;
  return (
    <div className={styles.relTile}>
      {photo ? <img src={photo} alt={name} className={styles.relImg} /> : <div className={styles.relImgPlaceholder} />}
      <div className={styles.relName}>{name}</div>
    </div>
  );
}

function RelationshipBlock({ label, value, placeholderKey }) {
  const v = value && typeof value === 'object' ? value : { name: String(value || ''), photo: '' };
  const name = String(v.name || '').trim();
  const photo = String(v.photo || '').trim();
  return (
    <FieldLine label={label}>
      {name ? <RelationshipThumb name={name} photo={photo} /> : <span>{placeholderFor(placeholderKey || label.toLowerCase())}</span>}
    </FieldLine>
  );
}

function RelationshipList({ label, values, placeholderKey }) {
  const list = Array.isArray(values) ? values : [];
  return (
    <FieldLine label={label}>
      {list.length ? (
        <div className={styles.relList}>
          {list.map((v) => {
            const obj = v && typeof v === 'object' ? v : { name: String(v || ''), photo: '' };
            const name = String(obj.name || '').trim();
            const photo = String(obj.photo || '').trim();
            if (!name) return null;
            return <RelationshipThumb key={`${label}-${name}`} name={name} photo={photo} />;
          })}
        </div>
      ) : (
        <span>{placeholderFor(placeholderKey || label.toLowerCase())}</span>
      )}
    </FieldLine>
  );
}

export default function NodeDetailsModal() {
  const { state, dispatch } = useAppState();
  const node = state.nodes.find((item) => item.id === state.activeNodeId);

  const [copiedKey, setCopiedKey] = useState(null);

  const close = useCallback(() => {
    dispatch({ type: ACTIONS.CLOSE_NODE_MODAL });
  }, [dispatch]);

  const markCopied = useCallback((key) => {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 900);
  }, []);

  const handleCopy = useCallback(async (key, text) => {
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (ok) markCopied(key);
  }, [markCopied]);

  const content = useMemo(() => {
    if (!node) return null;
    const data = node.data || {};
    const nodeType = data.nodeType || NODE_TYPES.STANDARD;

    if (nodeType === NODE_TYPES.PERSONS) {
      const people = Array.isArray(data.people) ? data.people : [];
      return (
        <>
          <div className={styles.title}>{data.title || 'Persons node'}</div>
          {data.photoCaption ? <div className={styles.caption}>{data.photoCaption}</div> : null}

          <Divider />

          <div className={styles.peopleList}>
            {people.length === 0 && <div className={styles.muted}>No people yet</div>}
            {people.map((p) => (
              <div key={p.id} className={styles.personRow}>
                {p.photo ? (
                  <img className={styles.personThumb} src={p.photo} alt={p.fullName || 'Person'} />
                ) : (
                  <div className={styles.personThumbFallback}>?</div>
                )}
                <div className={styles.personText}>
                  <div className={styles.personName}>{p.fullName || 'Unknown'}</div>
                  {p.nickname ? <div className={styles.personNick}>{p.nickname}</div> : null}
                </div>
              </div>
            ))}
          </div>
        </>
      );
    }

    const person = data.standardPerson || {};
    const stillAlive = Boolean(person.stillAlive);

    const renderIfVisible = (field, label, renderFn) => {
      if (isHidden(person, field)) return null;
      const raw = person?.[field];
      const value = displayValue(person, field);

      if (renderFn) {
        return (
          <FieldLine key={field} label={label}>
            {renderFn(value, raw)}
          </FieldLine>
        );
      }

      if (field === 'moreInfo') {
        return (
          <FieldLine key={field} label={label}>
            <div className={styles.preWrap}>{String(value)}</div>
          </FieldLine>
        );
      }

      return (
        <FieldLine key={field} label={label}>
          {String(value)}
        </FieldLine>
      );
    };

    const personalItems = [
      renderIfVisible('prefix', 'Title / Prefix'),
      renderIfVisible('maidenName', 'Maiden name / Birth surname')
    ].filter(Boolean);

    const aboutItems = [
      renderIfVisible('birthDate', 'Birth date'),
      renderIfVisible('birthPlace', 'Birth place'),
      ...(stillAlive ? [] : [renderIfVisible('deathDate', 'Death date'), renderIfVisible('deathPlace', 'Death place')]),
      renderIfVisible('occupation', 'Occupation'),
      renderIfVisible('address', 'Address', (value) => {
        const address = String(value || '');
        const isValid = address && address !== placeholderFor('address');
        return (
          <div className={styles.copyLine}>
            <div className={styles.preWrap}>{address}</div>
            {isValid ? (
              <div className={styles.copyActions}>
                <MapLinkButton address={address} />
                <Button size="xs" appearance="ghost" onClick={() => handleCopy('address', address)}>
                  {copiedKey === 'address' ? 'Copied' : 'Copy'}
                </Button>
              </div>
            ) : null}
          </div>
        );
      }),
      renderIfVisible('contactNumber', 'Contact number', (value) => {
        const num = String(value || '');
        const isValid = num && num !== placeholderFor('contactNumber');
        if (!isValid) {
          return <span>{placeholderFor('contactNumber')}</span>;
        }
        return (
          <Button
            size="xs"
            appearance="ghost"
            className={styles.copyNumber}
            onClick={() => handleCopy('contactNumber', num)}
          >
            {copiedKey === 'contactNumber' ? 'Copied' : num}
          </Button>
        );
      }),
      renderIfVisible('moreInfo', 'More information')
    ].filter(Boolean);

    const relationshipItems = [
      !isHidden(person, 'mother') ? <RelationshipBlock key="mother" label="Mother" value={person.mother} placeholderKey="mother" /> : null,
      !isHidden(person, 'father') ? <RelationshipBlock key="father" label="Father" value={person.father} placeholderKey="father" /> : null,
      !isHidden(person, 'children') ? <RelationshipList key="children" label="Children" values={person.children} placeholderKey="children" /> : null,
      !isHidden(person, 'siblings') ? <RelationshipList key="siblings" label="Siblings" values={person.siblings} placeholderKey="siblings" /> : null,
      !isHidden(person, 'girlfriends') ? <RelationshipList key="girlfriends" label="Girlfriends" values={person.girlfriends} placeholderKey="girlfriends" /> : null,
      !isHidden(person, 'boyfriends') ? <RelationshipList key="boyfriends" label="Boyfriends" values={person.boyfriends} placeholderKey="boyfriends" /> : null,
      !isHidden(person, 'husbands') ? <RelationshipList key="husbands" label="Husbands" values={person.husbands} placeholderKey="husbands" /> : null,
      !isHidden(person, 'wives') ? <RelationshipList key="wives" label="Wives" values={person.wives} placeholderKey="wives" /> : null,
      !isHidden(person, 'stepFathers') ? <RelationshipList key="stepFathers" label="Step fathers" values={person.stepFathers} placeholderKey="stepFathers" /> : null,
      !isHidden(person, 'stepMothers') ? <RelationshipList key="stepMothers" label="Step mothers" values={person.stepMothers} placeholderKey="stepMothers" /> : null,
      !isHidden(person, 'fosterParents') ? <RelationshipList key="fosterParents" label="Foster parents" values={person.fosterParents} placeholderKey="fosterParents" /> : null,
      !isHidden(person, 'fosterChildren') ? <RelationshipList key="fosterChildren" label="Foster children" values={person.fosterChildren} placeholderKey="fosterChildren" /> : null,
      !isHidden(person, 'adoptiveParents') ? <RelationshipList key="adoptiveParents" label="Adoptive parents" values={person.adoptiveParents} placeholderKey="adoptiveParents" /> : null,
      !isHidden(person, 'adoptedChildren') ? <RelationshipList key="adoptedChildren" label="Adopted children" values={person.adoptedChildren} placeholderKey="adoptedChildren" /> : null
    ].filter(Boolean);

    return (
      <>
        <div className={styles.title}>{data.title || 'Standard person node'}</div>

        <div className={styles.hero}>
          {person.photo ? (
            <img className={styles.heroImg} src={person.photo} alt={person.fullName || 'Person'} />
          ) : (
            <div className={styles.heroFallback}>No image provided</div>
          )}
          <div className={styles.heroMeta}>
            <div className={styles.heroName}>{displayValue(person, 'fullName')}</div>
            {String(displayValue(person, 'nickname')) !== 'Unknown' ? (
              <div className={styles.heroNick}>{displayValue(person, 'nickname')}</div>
            ) : null}
          </div>
        </div>

        {personalItems.length ? (
          <>
            <Divider />
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Personal details</div>
              {personalItems}
            </div>
          </>
        ) : null}

        {aboutItems.length ? (
          <>
            <Divider />
            <div className={styles.section}>
              <div className={styles.sectionTitle}>About this person</div>
              {aboutItems}
            </div>
          </>
        ) : null}

        {relationshipItems.length ? (
          <>
            <Divider />
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Relationships</div>
              {relationshipItems}
            </div>
          </>
        ) : null}
      </>
    );
  }, [node, copiedKey, handleCopy, state.nodes]);

  if (!state.isNodeModalOpen || !node) return null;

  return (
    <Modal open={state.isNodeModalOpen} onClose={close} size="md" className={styles.modal}>
      <Modal.Header>
        <Modal.Title>Node details</Modal.Title>
      </Modal.Header>
      <Modal.Body>{content}</Modal.Body>
      <Modal.Footer>
        <Button onClick={close} appearance="primary">
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
