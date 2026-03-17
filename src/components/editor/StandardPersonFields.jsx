import React, { memo, useEffect, useMemo, useState } from 'react';
import { Button, Divider, Form, Input, InputPicker, SelectPicker } from 'rsuite';
import styles from './PersonFields.module.css';
import {
  RELATIONSHIP_OPTIONS,
  createEmptyRelationshipEntry,
  createStandardPersonWrapper,
  getDynamicPersonFieldKeys,
  getPersonFieldMeta,
  getRecordName,
  getRecordNickname,
  getRecordBirthDate,
  getRecordPhoto,
  syncNodeDetailsWithPerson,
  personRecordToLinkedDraft
} from '../../utils/family3Schema';
import { buildSavedPeopleOptions, resolveSavedPersonSelection } from './savedPeopleOptions';

function pickerData(values = []) {
  return values.map((value) => ({ label: value, value }));
}

function buildTypeOptions(groupKey) {
  return pickerData(RELATIONSHIP_OPTIONS[groupKey] || []);
}

function renderPersonOption(label, item) {
  const person = item?.person;
  return (
    <div className={styles.userOption}>
      <div className={styles.userOptionName}>{label}</div>
      {getRecordNickname(person) ? <div className={styles.userOptionMeta}>{getRecordNickname(person)}</div> : null}
    </div>
  );
}

function RelationshipCard({ groupKey, label, entry, index, onChange, onRemove, savedPeopleOptions, savedPeople = [] }) {
  const applyPerson = (record, fallbackValue = '') => {
    const linked = personRecordToLinkedDraft(record, { fullName: getRecordName(record) || fallbackValue || '' });
    onChange({
      ...entry,
      ...linked,
      name: linked.fullName || fallbackValue || '',
      birthDate: getRecordBirthDate(record) || linked.birthDate || entry.birthDate || '',
      photo: getRecordPhoto(record) || linked.photo || entry.photo || ''
    });
  };

  const handleSelect = (value, item) => {
    const matched = resolveSavedPersonSelection(savedPeopleOptions, savedPeople, value, item);
    if (matched) {
      applyPerson(matched, value);
      return;
    }

    onChange({ ...entry, name: value || '' });
  };

  const handleNameChange = (value, item) => {
    const matched = resolveSavedPersonSelection(savedPeopleOptions, savedPeople, value, item);
    if (matched) {
      applyPerson(matched, value);
      return;
    }

    onChange({ ...entry, name: value || '' });
  };

  return (
    <div className={styles.relationshipCard}>
      <div className={styles.personCardHeader}>
        <div className={styles.personCardTitle}>{label} {index + 1}</div>
        <Button appearance="subtle" color="red" size="xs" onClick={onRemove}>Remove</Button>
      </div>
      <div className={styles.relationshipGrid}>
        <Form.Group>
          <Form.ControlLabel>Relationship type</Form.ControlLabel>
          <SelectPicker
            block
            cleanable={false}
            searchable={false}
            data={buildTypeOptions(groupKey)}
            value={entry.type || ''}
            onChange={(value) => onChange({ ...entry, type: value || '' })}
          />
        </Form.Group>

        <Form.Group>
          <Form.ControlLabel>Full name</Form.ControlLabel>
          <InputPicker
            block
            data={savedPeopleOptions}
            value={entry.name || ''}
            onChange={(value, item) => handleNameChange(value, item)}
            onSelect={handleSelect}
            placeholder="Type a name or select an existing person"
            searchable
            cleanable
            creatable
            renderMenuItem={renderPersonOption}
          />
        </Form.Group>

        {groupKey === 'parents' ? (
          <Form.Group>
            <Form.ControlLabel>Birth date</Form.ControlLabel>
            <Input type="date" value={entry.birthDate || ''} onChange={(value) => onChange({ ...entry, birthDate: value || '' })} />
          </Form.Group>
        ) : null}

        <Form.Group>
          <Form.ControlLabel>Photo</Form.ControlLabel>
          <Input value={entry.photo || ''} onChange={(value) => onChange({ ...entry, photo: value || '' })} placeholder="Paste an image URL" />
        </Form.Group>
      </div>
    </div>
  );
}

function DynamicPersonField({ fieldKey, value, onChange, savedPeopleOptions, savedPeople = [], onAutofillPerson }) {
  const meta = getPersonFieldMeta(fieldKey, value);
  const isFullSpan = meta.inputType === 'textarea';

  if (meta.inputType === 'person-name') {
    return (
      <Form.Group className={isFullSpan ? styles.fullSpan : ''}>
        <Form.ControlLabel>{meta.label}</Form.ControlLabel>
        <InputPicker
          block
          data={savedPeopleOptions}
          value={value || ''}
          onChange={(nextValue) => {
            const matched = resolveSavedPersonSelection(savedPeopleOptions, savedPeople, nextValue, null);
            if (matched && onAutofillPerson) {
              onAutofillPerson(null, matched);
              return;
            }
            onChange(nextValue || '');
          }}
          onSelect={(nextValue, item) => {
            const matched = resolveSavedPersonSelection(savedPeopleOptions, savedPeople, nextValue, item);
            if (matched && onAutofillPerson) {
              onAutofillPerson(null, matched);
              return;
            }
            onChange(nextValue || '');
          }}
          placeholder={meta.placeholder || 'Type a name or select an existing person'}
          searchable
          cleanable
          creatable
          renderMenuItem={renderPersonOption}
        />
      </Form.Group>
    );
  }

  if (meta.inputType === 'select') {
    const normalizedValue = fieldKey === 'isAlive'
      ? (value === true ? 'Yes' : value === false ? 'No' : String(value || ''))
      : (value || '');

    return (
      <Form.Group className={isFullSpan ? styles.fullSpan : ''}>
        <Form.ControlLabel>{meta.label}</Form.ControlLabel>
        <SelectPicker
          block
          cleanable
          searchable={false}
          data={pickerData(meta.options || [])}
          value={normalizedValue}
          onChange={(nextValue) => {
            if (fieldKey === 'isAlive') {
              if (nextValue === 'Yes') onChange('true');
              else if (nextValue === 'No') onChange('false');
              else if (nextValue === 'Not sure') onChange('unknown');
              else onChange('');
              return;
            }
            onChange(nextValue || '');
          }}
        />
      </Form.Group>
    );
  }

  if (meta.inputType === 'date') {
    return (
      <Form.Group className={isFullSpan ? styles.fullSpan : ''}>
        <Form.ControlLabel>{meta.label}</Form.ControlLabel>
        <Input type="date" value={value || ''} onChange={(nextValue) => onChange(nextValue || '')} />
      </Form.Group>
    );
  }

  if (meta.inputType === 'textarea') {
    return (
      <Form.Group className={styles.fullSpan}>
        <Form.ControlLabel>{meta.label}</Form.ControlLabel>
        <Input as="textarea" rows={meta.rows || 4} value={value || ''} onChange={(nextValue) => onChange(nextValue || '')} placeholder={meta.placeholder || ''} />
      </Form.Group>
    );
  }

  return (
    <Form.Group className={isFullSpan ? styles.fullSpan : ''}>
      <Form.ControlLabel>{meta.label}</Form.ControlLabel>
      <Input value={value || ''} onChange={(nextValue) => onChange(nextValue || '')} placeholder={meta.placeholder || ''} />
    </Form.Group>
  );
}

function StandardPersonFields({ person, setPerson, savedPeople = [], onAutofillPerson, onSaveSection, onStatusChange, showSectionSaveButtons = true }) {
  const [saveStatus, setSaveStatus] = useState({ personal: 'idle', node: 'idle', relationships: 'idle' });

  useEffect(() => {
    const next = { personal: 'idle', node: 'idle', relationships: 'idle' };
    setSaveStatus(next);
    onStatusChange?.(next);
  }, [onStatusChange, person?.id]);

  const savedPeopleOptions = useMemo(() => buildSavedPeopleOptions(savedPeople), [savedPeople]);
  const draft = useMemo(() => createStandardPersonWrapper(person), [person]);
  const personData = draft.person || {};
  const relationshipData = draft.person?.relationships || draft.relationships || {};
  const nodeData = draft.person?.node || draft.node || {};
  const dynamicPersonKeys = useMemo(() => getDynamicPersonFieldKeys(personData), [personData]);

  const markDirty = (section) => {
    setSaveStatus((prev) => {
      const next = { ...(prev || {}), [section]: 'dirty' };
      onStatusChange?.(next);
      return next;
    });
  };

  const markSaved = (section) => {
    setSaveStatus((prev) => {
      const next = { ...(prev || {}), [section]: 'saved' };
      onStatusChange?.(next);
      return next;
    });
    window.setTimeout(() => {
      setSaveStatus((prev) => {
        const next = { ...(prev || {}), [section]: 'idle' };
        onStatusChange?.(next);
        return next;
      });
    }, 1200);
  };

  const sectionBtnClass = (section) => {
    const s = saveStatus?.[section] || 'idle';
    if (s === 'dirty') return styles.saveBtnDirty;
    if (s === 'saved') return styles.saveBtnSaved;
    return '';
  };

  const updateWrapper = (updater, section) => {
    markDirty(section);
    setPerson((prev) => createStandardPersonWrapper(updater(createStandardPersonWrapper(prev))));
  };

  const updatePersonField = (field, value, section) => {
    updateWrapper((prev) => {
      const nextPerson = { ...(prev?.person || {}), [field]: value };
      const nextNode = syncNodeDetailsWithPerson(prev?.person?.node || prev?.node || {}, nextPerson);
      return {
        ...prev,
        person: {
          ...nextPerson,
          node: nextNode
        },
        node: nextNode
      };
    }, section);
  };

  const updateNodeField = (field, value) => {
    updateWrapper((prev) => ({
      ...prev,
      person: {
        ...(prev?.person || {}),
        node: {
          ...(prev?.person?.node || prev?.node || {}),
          [field]: value
        }
      },
      node: {
        ...(prev?.person?.node || prev?.node || {}),
        [field]: value
      }
    }), 'node');
  };

  const updateRelationshipGroup = (groupKey, nextEntries) => {
    updateWrapper((prev) => ({
      ...prev,
      person: {
        ...(prev?.person || {}),
        relationships: {
          ...(prev?.person?.relationships || prev?.relationships || {}),
          [groupKey]: nextEntries
        }
      },
      relationships: {
        ...(prev?.person?.relationships || prev?.relationships || {}),
        [groupKey]: nextEntries
      }
    }), 'relationships');
  };

  const addRelationship = (groupKey) => {
    const next = [...(relationshipData?.[groupKey] || []), createEmptyRelationshipEntry()];
    updateRelationshipGroup(groupKey, next);
  };

  const updateRelationship = (groupKey, index, nextEntry) => {
    const next = [...(relationshipData?.[groupKey] || [])];
    next[index] = createEmptyRelationshipEntry(nextEntry);
    updateRelationshipGroup(groupKey, next);
  };

  const removeRelationship = (groupKey, index) => {
    const next = [...(relationshipData?.[groupKey] || [])];
    next.splice(index, 1);
    updateRelationshipGroup(groupKey, next);
  };

  return (
    <div className={styles.standardPersonWrap}>
      <Divider className={styles.sectionDivider}>Person details</Divider>
      <div className={styles.glassPanel}>
        <div className={styles.formGrid}>
          {dynamicPersonKeys.map((fieldKey) => (
            <DynamicPersonField
              key={fieldKey}
              fieldKey={fieldKey}
              value={personData?.[fieldKey]}
              onChange={(value) => updatePersonField(fieldKey, value, 'personal')}
              savedPeopleOptions={savedPeopleOptions}
              savedPeople={savedPeople}
              onAutofillPerson={(value, selectedPerson) => {
                markDirty('personal');
                onAutofillPerson?.(value, selectedPerson);
              }}
            />
          ))}
        </div>
        {showSectionSaveButtons ? (
          <Button appearance="primary" className={`${styles.saveBarButton} ${sectionBtnClass('personal')}`} block onClick={() => { onSaveSection?.(draft); markSaved('personal'); }}>
            {saveStatus.personal === 'saved' ? 'Saved ✓' : 'Save person details'}
          </Button>
        ) : null}
      </div>

      <Divider className={styles.sectionDivider}>Node details</Divider>
      <div className={styles.glassPanel}>
        <div className={styles.formGrid}>
          <Form.Group>
            <Form.ControlLabel>Title</Form.ControlLabel>
            <Input value={nodeData.title || ''} onChange={(value) => updateNodeField('title', value || '')} />
          </Form.Group>
          <Form.Group>
            <Form.ControlLabel>Node cover image</Form.ControlLabel>
            <Input value={nodeData.coverImage || ''} onChange={(value) => updateNodeField('coverImage', value || '')} />
          </Form.Group>
          <Form.Group>
            <Form.ControlLabel>Image caption</Form.ControlLabel>
            <Input value={nodeData.imageCaption || ''} onChange={(value) => updateNodeField('imageCaption', value || '')} />
          </Form.Group>
          <Form.Group>
            <Form.ControlLabel>Event date</Form.ControlLabel>
            <Input type="date" value={nodeData.eventDate || ''} onChange={(value) => updateNodeField('eventDate', value || '')} />
          </Form.Group>
          <Form.Group>
            <Form.ControlLabel>Location</Form.ControlLabel>
            <Input value={nodeData.location || ''} onChange={(value) => updateNodeField('location', value || '')} />
          </Form.Group>
          <Form.Group className={styles.fullSpan}>
            <Form.ControlLabel>Notes</Form.ControlLabel>
            <Input as="textarea" rows={4} value={nodeData.notes || ''} onChange={(value) => updateNodeField('notes', value || '')} />
          </Form.Group>
        </div>
        {showSectionSaveButtons ? (
          <Button appearance="primary" className={`${styles.saveBarButton} ${sectionBtnClass('node')}`} block onClick={() => { onSaveSection?.(draft); markSaved('node'); }}>
            {saveStatus.node === 'saved' ? 'Saved ✓' : 'Save node details'}
          </Button>
        ) : null}
      </div>

      <Divider className={styles.sectionDivider}>Relationships</Divider>
      <div className={styles.glassPanel}>
        {['parents', 'children', 'siblings', 'partners'].map((groupKey) => {
          const title = groupKey.charAt(0).toUpperCase() + groupKey.slice(1);
          const entries = relationshipData[groupKey] || [];
          return (
            <div key={groupKey} className={styles.relationshipSection}>
              <div className={styles.relationshipHeader}>
                <div className={styles.personCardTitle}>{title}</div>
                <Button appearance="ghost" size="sm" onClick={() => addRelationship(groupKey)}>Add {groupKey.slice(0, -1) || groupKey}</Button>
              </div>
              {!entries.length ? <div className={styles.emptyState}>No {groupKey} added yet.</div> : null}
              {entries.map((entry, index) => (
                <RelationshipCard
                  key={`${groupKey}-${index}`}
                  groupKey={groupKey}
                  label={title.slice(0, -1) || title}
                  entry={entry}
                  index={index}
                  onChange={(nextEntry) => updateRelationship(groupKey, index, nextEntry)}
                  onRemove={() => removeRelationship(groupKey, index)}
                  savedPeopleOptions={savedPeopleOptions}
                  savedPeople={savedPeople}
                />
              ))}
            </div>
          );
        })}
        {showSectionSaveButtons ? (
          <Button appearance="primary" className={`${styles.saveBarButton} ${sectionBtnClass('relationships')}`} block onClick={() => { onSaveSection?.(draft); markSaved('relationships'); }}>
            {saveStatus.relationships === 'saved' ? 'Saved ✓' : 'Save relationships'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default memo(StandardPersonFields);
