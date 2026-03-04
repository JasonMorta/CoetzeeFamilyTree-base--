import React, { useMemo, useCallback } from 'react';
import { Drawer, Button, Form, Divider, Slider, Grid, Row, Col, SelectPicker, Input } from 'rsuite';
import styles from './NodeEditorDrawer.module.css';
import { useAppState } from '../../context/AppStateContext';
import { ACTIONS } from '../../context/appReducer';
import PersonFields from './PersonFields';
import { createEmptyPerson, NODE_TYPES, createDefaultPeopleByType } from '../../utils/nodeFactory';

const SIDE_LABELS = { top: 'Top', right: 'Right', bottom: 'Bottom', left: 'Left' };
const NODE_TYPE_OPTIONS = [
  { label: 'Standard Photo Node', value: NODE_TYPES.STANDARD },
  { label: 'Persons Node', value: NODE_TYPES.PERSONS },
  { label: 'Parents Node', value: NODE_TYPES.PARENTS }
];
const IMAGE_SIZE_OPTIONS = [
  { label: 'Cover', value: 'cover' },
  { label: 'Contain', value: 'contain' },
  { label: 'Auto', value: 'auto' }
];
const IMAGE_REPEAT_OPTIONS = [
  { label: 'No repeat', value: 'no-repeat' },
  { label: 'Repeat', value: 'repeat' },
  { label: 'Repeat X', value: 'repeat-x' },
  { label: 'Repeat Y', value: 'repeat-y' }
];
const IMAGE_POSITION_OPTIONS = [
  { label: 'Center', value: 'center center' },
  { label: 'Top', value: 'center top' },
  { label: 'Bottom', value: 'center bottom' },
  { label: 'Left', value: 'left center' },
  { label: 'Right', value: 'right center' }
];

function SliderField({ label, value, min, max, step = 1, onChange, help }) {
  return (
    <div className={styles.sliderField}>
      <div className={styles.sliderHeader}>
        <span>{label}</span>
        <strong>{Math.round(Number(value) || 0)}</strong>
      </div>
      <Slider progress min={min} max={max} step={step} value={Number(value) || 0} onChange={onChange} />
      {help && <div className={styles.help}>{help}</div>}
    </div>
  );
}

export default function NodeEditorDrawer() {
  const { state, dispatch } = useAppState();
  const selectedNode = useMemo(() => state.nodes.find((node) => node.id === state.selectedNodeId), [state.nodes, state.selectedNodeId]);
  const nodeData = selectedNode?.data;

  const updateNode = useCallback((patch) => {
    if (!selectedNode) return;
    dispatch({ type: ACTIONS.UPDATE_NODE_DATA, payload: { id: selectedNode.id, data: patch } });
  }, [dispatch, selectedNode]);

  const updateRootField = useCallback((field, value) => updateNode({ [field]: value }), [updateNode]);
  const updateImageSetting = useCallback((field, value) => updateNode({ imageSettings: { ...(nodeData?.imageSettings || {}), [field]: value } }), [nodeData?.imageSettings, updateNode]);

  const updateNodeSize = useCallback((value) => {
    const nextSize = Math.max(100, Math.min(800, Number(value) || 220));
    updateNode({ nodeWidth: nextSize, nodeHeight: nextSize });
  }, [updateNode]);

  const updateNodeType = useCallback((value) => {
    const nextType = value || NODE_TYPES.STANDARD;
    const patch = { nodeType: nextType };
    if (nextType === NODE_TYPES.STANDARD) {
      patch.people = [];
    } else if (nextType === NODE_TYPES.PERSONS && (!nodeData?.people || nodeData.people.length === 0)) {
      patch.people = createDefaultPeopleByType(NODE_TYPES.PERSONS);
    } else if (nextType === NODE_TYPES.PARENTS) {
      const parents = [...(nodeData?.people || [])];
      while (parents.length < 2) parents.push(createEmptyPerson());
      if (!parents[0]) parents[0] = createEmptyPerson();
      parents[0] = { ...parents[0], relationshipToPrimary: 'primary' };
      patch.people = parents;
    }
    updateNode(patch);
  }, [nodeData?.people, updateNode]);

  const updatePersonField = useCallback((personId, field, value) => {
    const nextPeople = (nodeData?.people || []).map((person) => person.id === personId ? { ...person, [field]: value } : person);
    if (nodeData?.nodeType === NODE_TYPES.PARENTS && nextPeople.length) {
      nextPeople[0] = { ...nextPeople[0], relationshipToPrimary: 'primary' };
    }
    updateNode({ people: nextPeople });
  }, [nodeData?.people, nodeData?.nodeType, updateNode]);

  const addPerson = useCallback(() => updateNode({ people: [...(nodeData?.people || []), createEmptyPerson()] }), [nodeData?.people, updateNode]);
  const removePerson = useCallback((personId) => {
    const remaining = (nodeData?.people || []).filter((person) => person.id !== personId);
    if (nodeData?.nodeType === NODE_TYPES.PARENTS && remaining.length) {
      remaining[0] = { ...remaining[0], relationshipToPrimary: 'primary' };
    }
    updateNode({ people: remaining });
  }, [nodeData?.people, nodeData?.nodeType, updateNode]);

  const updateHandleCount = useCallback((side, value) => updateNode({ handles: { ...(nodeData?.handles || {}), [side]: Math.max(0, Number(value) || 0) } }), [nodeData?.handles, updateNode]);
  const updateHandleLayout = useCallback((side, field, value) => updateNode({ handleLayout: { ...(nodeData?.handleLayout || {}), [side]: { ...(nodeData?.handleLayout?.[side] || {}), [field]: Math.max(0, Math.min(100, Number(value) || 0)) } } }), [nodeData?.handleLayout, updateNode]);

  if (!selectedNode || !nodeData || !state.isEditorOpen) return null;

  const isStandard = nodeData.nodeType === NODE_TYPES.STANDARD;
  const isParents = nodeData.nodeType === NODE_TYPES.PARENTS;
  const canAddPeople = nodeData.nodeType === NODE_TYPES.PERSONS || nodeData.nodeType === NODE_TYPES.PARENTS;
  const primaryLabel = nodeData.people?.[0]?.fullName || 'the primary person';

  return (
    <Drawer open={state.isEditorOpen} onClose={() => dispatch({ type: ACTIONS.CLOSE_EDITOR })} size="sm" className={styles.drawer}>
      <Drawer.Header><Drawer.Title>Edit Family Node</Drawer.Title></Drawer.Header>
      <Drawer.Body className={styles.body}>
        <div className={styles.note}>This editor updates live. Change the node type first, then fill only the sections that belong to that type.</div>
        <Form fluid>
          <Form.Group controlId="node-type">
            <Form.ControlLabel>Node type</Form.ControlLabel>
            <SelectPicker block cleanable={false} searchable={false} data={NODE_TYPE_OPTIONS} value={nodeData.nodeType || NODE_TYPES.STANDARD} onChange={updateNodeType} />
          </Form.Group>

          <Form.Group controlId="node-title">
            <Form.ControlLabel>Title</Form.ControlLabel>
            <Form.Control name="title" value={nodeData.title} onChange={(value) => updateRootField('title', value)} />
          </Form.Group>

          {isStandard && (
            <>
              <Form.Group controlId="node-photo">
                <Form.ControlLabel>Image URL or Data URL</Form.ControlLabel>
                <Form.Control name="photo" value={nodeData.photo} onChange={(value) => updateRootField('photo', value)} />
              </Form.Group>
              <Form.Group controlId="photo-caption"><Form.ControlLabel>Image caption</Form.ControlLabel><Form.Control name="photoCaption" value={nodeData.photoCaption} onChange={(value) => updateRootField('photoCaption', value)} /></Form.Group>
              <Form.Group controlId="event-date"><Form.ControlLabel>Event date</Form.ControlLabel><Form.Control accepter={Input} name="eventDate" type="date" value={nodeData.eventDate} onChange={(value) => updateRootField('eventDate', value)} /></Form.Group>
              <Form.Group controlId="location"><Form.ControlLabel>Location</Form.ControlLabel><Form.Control name="location" value={nodeData.location} onChange={(value) => updateRootField('location', value)} /></Form.Group>
              <Form.Group controlId="notes"><Form.ControlLabel>Notes</Form.ControlLabel><Input as="textarea" rows={3} value={nodeData.notes} onChange={(value) => updateRootField('notes', value)} /></Form.Group>
            </>
          )}

          {!isStandard && (
            <>
              <Divider>{isParents ? 'Primary person and related adults' : 'People in this node'}</Divider>
              {(nodeData.people || []).map((person, index) => (
                <PersonFields
                  key={person.id}
                  person={person}
                  index={index}
                  onChange={updatePersonField}
                  onRemove={removePerson}
                  canRemove={canAddPeople && (nodeData.people || []).length > (isParents ? 1 : 1)}
                  showRelationshipToPrimary={isParents}
                  primaryPersonLabel={primaryLabel}
                />
              ))}
              {canAddPeople && <Button appearance="ghost" onClick={addPerson}>Add another person</Button>}
              <Divider>Shared notes</Divider>
              <Form.Group controlId="notes-shared"><Form.ControlLabel>Notes</Form.ControlLabel>
              <Input as="textarea" rows={3} value={nodeData.notes} onChange={(value) => updateRootField('notes', value)} />
              </Form.Group>
            </>
          )}

          <Divider>Node appearance</Divider>
          <Grid fluid>
            <Row gutter={16}>
              <Col xs={24} sm={12}><SliderField label="Node size" value={nodeData.nodeWidth} min={100} max={800} onChange={updateNodeSize} help="This single slider scales both width and height together." /></Col>
              <Col xs={24} sm={12}><SliderField label="Border radius" value={nodeData.nodeRadius} min={8} max={36} onChange={(value) => updateRootField('nodeRadius', value)} help="Reduce this if the cards feel too rounded." /></Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={12}><SliderField label="Person image size" value={nodeData.imageSettings?.personImageSize ?? 72} min={44} max={140} onChange={(value) => updateImageSetting('personImageSize', value)} help="Used by People and Parents nodes inside the canvas card." /></Col>
              <Col xs={24} sm={12}><Form.Group><Form.ControlLabel>Image size mode</Form.ControlLabel><SelectPicker cleanable={false} searchable={false} block data={IMAGE_SIZE_OPTIONS} value={nodeData.imageSettings?.nodeImageSize || 'cover'} onChange={(value) => updateImageSetting('nodeImageSize', value)} /></Form.Group></Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={12}><Form.Group><Form.ControlLabel>Image repeat</Form.ControlLabel><SelectPicker cleanable={false} searchable={false} block data={IMAGE_REPEAT_OPTIONS} value={nodeData.imageSettings?.nodeImageRepeat || 'no-repeat'} onChange={(value) => updateImageSetting('nodeImageRepeat', value)} /></Form.Group></Col>
              <Col xs={24} sm={12}><Form.Group><Form.ControlLabel>Image position</Form.ControlLabel><SelectPicker cleanable={false} searchable={false} block data={IMAGE_POSITION_OPTIONS} value={nodeData.imageSettings?.nodeImagePosition || 'center center'} onChange={(value) => updateImageSetting('nodeImagePosition', value)} /></Form.Group></Col>
            </Row>
          </Grid>

          <Divider>Connection points</Divider>
          {Object.entries(SIDE_LABELS).map(([side, label]) => (
            <div className={styles.sideCard} key={side}>
              <div className={styles.sideTitle}>{label} side</div>
              <Grid fluid>
                <Row gutter={16}>
                  <Col xs={24} sm={8}><SliderField label="Points" value={nodeData.handles?.[side] ?? 0} min={0} max={8} onChange={(value) => updateHandleCount(side, value)} /></Col>
                  <Col xs={24} sm={8}><SliderField label="Anchor" value={nodeData.handleLayout?.[side]?.anchor ?? 50} min={0} max={100} onChange={(value) => updateHandleLayout(side, 'anchor', value)} /></Col>
                  <Col xs={24} sm={8}><SliderField label="Spread" value={nodeData.handleLayout?.[side]?.spread ?? 40} min={0} max={100} onChange={(value) => updateHandleLayout(side, 'spread', value)} /></Col>
                </Row>
              </Grid>
            </div>
          ))}
        </Form>
      </Drawer.Body>
    </Drawer>
  );
}
