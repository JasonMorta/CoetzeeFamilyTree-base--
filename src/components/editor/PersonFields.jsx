import React, { memo, useMemo } from 'react';
import { Form, Button, Input, InputPicker, Divider } from 'rsuite';
import styles from './PersonFields.module.css';

function buildSavedPeopleOptions(savedPeople = []) {
  return (savedPeople || [])
    .filter((p) => (p?.fullName || '').trim().length > 0)
    .map((p) => ({
      label: p.fullName,
      value: p.fullName,
      person: p
    }));
}

function renderPersonOption(label, item) {
  const person = item?.person;
  return (
    <div className={styles.userOption}>
      <div className={styles.userOptionName}>{label}</div>
      {person?.nickname ? <div className={styles.userOptionMeta}>{person.nickname}</div> : null}
    </div>
  );
}

function PersonFields({ person, index, onChange, onRemove, canRemove, savedPeople = [], onAutofillPerson }) {
  const savedPeopleOptions = useMemo(() => buildSavedPeopleOptions(savedPeople), [savedPeople]);
  const pickerOptions = useMemo(() => savedPeopleOptions.slice(0, 15), [savedPeopleOptions]);

  const handleNameSelect = (value, item) => {
    // Allow free typing always. Selecting an existing person should autofill minimal fields.
    if (item?.person && onAutofillPerson) {
      onAutofillPerson(person.id, item.person);
    } else {
      onChange(person.id, 'fullName', value || '');
    }
  };

  return (
    <div className={styles.personCard}>
      <div className={styles.personCardHeader}>
        <div className={styles.personCardTitle}>Person {index + 1}</div>
        {canRemove && (
          <Button appearance="subtle" color="red" size="xs" onClick={() => onRemove(person.id)}>
            Remove
          </Button>
        )}
      </div>

      <Divider className={styles.sectionDivider} />

      <Form fluid>
        <Form.Group controlId={`person-${person.id}-fullName`}>
          <Form.ControlLabel>Name &amp; Surname</Form.ControlLabel>
          <InputPicker
            data={pickerOptions}
            value={person.fullName || ''}
            onChange={(val) => onChange(person.id, 'fullName', val || '')}
            onSelect={handleNameSelect}
            placeholder="Type a name or select an existing person"
            searchable
            creatable
            renderMenuItem={renderPersonOption}
            cleanable
          />
        </Form.Group>

        <Form.Group controlId={`person-${person.id}-nickname`}>
          <Form.ControlLabel>Nickname</Form.ControlLabel>
          <Input
            value={person.nickname || ''}
            onChange={(val) => onChange(person.id, 'nickname', val)}
            placeholder="Optional"
          />
        </Form.Group>

        <Form.Group controlId={`person-${person.id}-photo`}>
          <Form.ControlLabel>Image URL</Form.ControlLabel>
          <Input
            value={person.photo || ''}
            onChange={(val) => onChange(person.id, 'photo', val)}
            placeholder="Paste an image URL"
          />
        </Form.Group>
      </Form>
    </div>
  );
}

export default memo(PersonFields);
