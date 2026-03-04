import React, { memo } from 'react';
import { Form, Button, Input, SelectPicker } from 'rsuite';
import styles from './PersonFields.module.css';
import { RELATIONSHIP_OPTIONS } from '../../utils/nodeFactory';

function PersonFields({
  person,
  index,
  onChange,
  onRemove,
  canRemove,
  showRelationshipToPrimary = false,
  primaryPersonLabel = 'the primary person'
}) {
  function updateField(field, value) {
    onChange(person.id, field, value);
  }

  return (
    <div className={styles.card}>
      <h5>{index === 0 && showRelationshipToPrimary ? 'Primary person' : `Person ${index + 1}`}</h5>

      <Form.Group controlId={`photo_${person.id}`}>
        <Form.ControlLabel>Image URL</Form.ControlLabel>
        <Form.Control name={`photo_${person.id}`} value={person.photo || ''} onChange={(value) => updateField('photo', value)} />
      </Form.Group>

      <Form.Group controlId={`fullName_${person.id}`}>
        <Form.ControlLabel>Name and surname</Form.ControlLabel>
        <Form.Control name={`fullName_${person.id}`} value={person.fullName} onChange={(value) => updateField('fullName', value)} />
      </Form.Group>

      <Form.Group controlId={`nickname_${person.id}`}>
        <Form.ControlLabel>Nickname</Form.ControlLabel>
        <Form.Control name={`nickname_${person.id}`} value={person.nickname || ''} onChange={(value) => updateField('nickname', value)} />
      </Form.Group>

      <div className={styles.row}>
        <Form.Group controlId={`birthDate_${person.id}`}>
          <Form.ControlLabel>Birth date</Form.ControlLabel>
          <Form.Control accepter={Input} name={`birthDate_${person.id}`} type="date" value={person.birthDate} onChange={(value) => updateField('birthDate', value)} />
        </Form.Group>
        <Form.Group controlId={`deathDate_${person.id}`}>
          <Form.ControlLabel>Death date</Form.ControlLabel>
          <Form.Control accepter={Input} name={`deathDate_${person.id}`} type="date" value={person.deathDate} onChange={(value) => updateField('deathDate', value)} />
        </Form.Group>
      </div>

      <div className={styles.row}>
        <Form.Group controlId={`relationLabel_${person.id}`}>
          <Form.ControlLabel>Relation label (how this person relates in the family)</Form.ControlLabel>
          <Form.Control name={`relationLabel_${person.id}`} value={person.relationLabel} onChange={(value) => updateField('relationLabel', value)} />
        </Form.Group>
        <Form.Group controlId={`occupation_${person.id}`}>
          <Form.ControlLabel>Occupation</Form.ControlLabel>
          <Form.Control name={`occupation_${person.id}`} value={person.occupation} onChange={(value) => updateField('occupation', value)} />
        </Form.Group>
      </div>

      {showRelationshipToPrimary && index > 0 && (
        <>
          <Form.Group controlId={`relationshipToPrimary_${person.id}`}>
            <Form.ControlLabel>Relationship to primary person ({primaryPersonLabel})</Form.ControlLabel>
            <SelectPicker
              block
              cleanable={false}
              searchable={false}
              data={RELATIONSHIP_OPTIONS.filter((item) => item.value !== 'primary')}
              value={person.relationshipToPrimary || 'other'}
              onChange={(value) => updateField('relationshipToPrimary', value)}
            />
          </Form.Group>
          <Form.Group controlId={`relationshipNotes_${person.id}`}>
            <Form.ControlLabel>Relationship notes</Form.ControlLabel>
            <Form.Control name={`relationshipNotes_${person.id}`} value={person.relationshipNotes || ''} onChange={(value) => updateField('relationshipNotes', value)} />
          </Form.Group>
        </>
      )}

      <Form.Group controlId={`biography_${person.id}`}>
        <Form.ControlLabel>Biography (short life summary or important notes)</Form.ControlLabel>
        <Input as="textarea" rows={3} value={person.biography} onChange={(value) => updateField('biography', value)} />
      </Form.Group>

      {canRemove && (
        <Button appearance="ghost" color="red" onClick={() => onRemove(person.id)}>
          Remove Person
        </Button>
      )}
    </div>
  );
}

export default memo(PersonFields);
