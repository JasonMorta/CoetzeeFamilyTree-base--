import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { Drawer, Button, Form, Divider, Slider, Grid, Row, Col, SelectPicker, InputPicker, Input } from 'rsuite';
import styles from './NodeEditorDrawer.module.css';
import { useAppState } from '../../context/AppStateContext';
import { ACTIONS } from '../../context/appReducer';
import PersonFields from './PersonFields';
import StandardPersonFields from './StandardPersonFields';
import { createEmptyPerson, createEmptyStandardPerson, NODE_TYPES, createDefaultPeopleByType } from '../../utils/nodeFactory';

function normalizeFullName(name) {
  return (name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

// NOTE: This helper must be defined *before* any hook/callbacks that reference it.
// It is intentionally a plain function (not a hook) to avoid TDZ/initialization-order
// issues when used inside dependency arrays.
function upsertSavedPerson(library, person) {
  const key = normalizeFullName(person?.fullName);
  if (!key) return library;
  const next = Array.isArray(library) ? [...library] : [];
  const idx = next.findIndex((p) => normalizeFullName(p?.fullName) === key);
  const cleaned = { ...(person || {}) };

  // Keep the schema clean: no legacy fields
  delete cleaned.relationLabel;
  delete cleaned.biography;

  if (idx >= 0) {
    next[idx] = { ...next[idx], ...cleaned };
    return next;
  }
  next.push(cleaned);
  return next;
}

const SIDE_LABELS = { top: 'Top', right: 'Right', bottom: 'Bottom', left: 'Left' };
const NODE_TYPE_OPTIONS = [
  { label: 'Standard Person Photo Node', value: NODE_TYPES.STANDARD },
  { label: 'Persons Node', value: NODE_TYPES.PERSONS }
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

  // Draft states (avoid global state updates while typing)
  const [draftNodeMeta, setDraftNodeMeta] = useState({
    title: '',
    photo: '',
    photoCaption: '',
    eventDate: '',
    location: '',
    notes: ''
  });
  const [draftStandardPerson, setDraftStandardPerson] = useState(createEmptyStandardPerson());
  const [nodeMetaStatus, setNodeMetaStatus] = useState('idle');
  const [peopleStatus, setPeopleStatus] = useState('idle');
  const [standardStatus, setStandardStatus] = useState({ personal: 'idle', about: 'idle', relationships: 'idle' });
  const anyUnsaved = useMemo(() => nodeMetaStatus === 'dirty' || peopleStatus === 'dirty' || Object.values(standardStatus || {}).includes('dirty'), [nodeMetaStatus, peopleStatus, standardStatus]);
  const [closeWarning, setCloseWarning] = useState('');
  const [draftPeople, setDraftPeople] = useState([]);
  const [draftSharedNotes, setDraftSharedNotes] = useState('');

  useEffect(() => {
    if (!state.isEditorOpen) return;
    dispatch({ type: ACTIONS.SET_EDITOR_UNSAVED_CHANGES, payload: anyUnsaved });
  }, [anyUnsaved, dispatch, state.isEditorOpen]);

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
      patch.standardPerson = nodeData?.standardPerson || createEmptyPerson({ id: 'standard-person' });
    } else if (nextType === NODE_TYPES.PERSONS && (!nodeData?.people || nodeData.people.length === 0)) {
      patch.people = createDefaultPeopleByType(NODE_TYPES.PERSONS);
    }
    updateNode(patch);
  }, [nodeData?.people, updateNode]);

  const commitStandardPersonPatch = useCallback((patch) => {
    const current = nodeData?.standardPerson || createEmptyStandardPerson();
    updateNode({ standardPerson: { ...current, ...patch } });
  }, [nodeData?.standardPerson, updateNode]);

  const handleAutofillStandardPerson = useCallback((_, savedPerson) => {
    // Apply to draft only; commit happens on Save button.
    setDraftStandardPerson((prev) => {
      const current = prev || createEmptyStandardPerson();
      return {
        ...current,
        fullName: savedPerson?.fullName ?? current.fullName ?? '',
        nickname: savedPerson?.nickname ?? current.nickname ?? '',
        photo: savedPerson?.photo ?? current.photo ?? '',
        prefix: savedPerson?.prefix ?? current.prefix ?? '',
        maidenName: savedPerson?.maidenName ?? current.maidenName ?? '',
        birthDate: savedPerson?.birthDate ?? current.birthDate ?? '',
        birthPlace: savedPerson?.birthPlace ?? current.birthPlace ?? '',
        stillAlive: Boolean(savedPerson?.stillAlive ?? current.stillAlive),
        deathDate: savedPerson?.deathDate ?? current.deathDate ?? '',
        deathPlace: savedPerson?.deathPlace ?? current.deathPlace ?? '',
        occupation: savedPerson?.occupation ?? current.occupation ?? '',
        address: savedPerson?.address ?? savedPerson?.residence ?? current.address ?? '',
        contactNumber: savedPerson?.contactNumber ?? current.contactNumber ?? '',
        father: savedPerson?.father ?? current.father ?? { name: '', photo: '' },
        mother: savedPerson?.mother ?? current.mother ?? { name: '', photo: '' },
        children: Array.isArray(savedPerson?.children) ? savedPerson.children : (Array.isArray(current.children) ? current.children : []),
        siblings: Array.isArray(savedPerson?.siblings) ? savedPerson.siblings : (Array.isArray(current.siblings) ? current.siblings : []),
        girlfriends: Array.isArray(savedPerson?.girlfriends) ? savedPerson.girlfriends : (Array.isArray(current.girlfriends) ? current.girlfriends : []),
        boyfriends: Array.isArray(savedPerson?.boyfriends) ? savedPerson.boyfriends : (Array.isArray(current.boyfriends) ? current.boyfriends : []),
        husbands: Array.isArray(savedPerson?.husbands) ? savedPerson.husbands : (Array.isArray(current.husbands) ? current.husbands : []),
        wives: Array.isArray(savedPerson?.wives) ? savedPerson.wives : (Array.isArray(current.wives) ? current.wives : []),
        stepFathers: Array.isArray(savedPerson?.stepFathers) ? savedPerson.stepFathers : (Array.isArray(current.stepFathers) ? current.stepFathers : []),
        stepMothers: Array.isArray(savedPerson?.stepMothers) ? savedPerson.stepMothers : (Array.isArray(current.stepMothers) ? current.stepMothers : []),
        fosterParents: Array.isArray(savedPerson?.fosterParents) ? savedPerson.fosterParents : (Array.isArray(current.fosterParents) ? current.fosterParents : []),
        fosterChildren: Array.isArray(savedPerson?.fosterChildren) ? savedPerson.fosterChildren : (Array.isArray(current.fosterChildren) ? current.fosterChildren : []),
        adoptiveParents: Array.isArray(savedPerson?.adoptiveParents) ? savedPerson.adoptiveParents : (Array.isArray(current.adoptiveParents) ? current.adoptiveParents : []),
        adoptedChildren: Array.isArray(savedPerson?.adoptedChildren) ? savedPerson.adoptedChildren : (Array.isArray(current.adoptedChildren) ? current.adoptedChildren : []),
        moreInfo: savedPerson?.moreInfo ?? savedPerson?.biography ?? current.moreInfo ?? '',
        hiddenFields: (savedPerson?.hiddenFields && typeof savedPerson.hiddenFields === 'object') ? savedPerson.hiddenFields : (current.hiddenFields || {})
      };
    });
  }, []);


  const updateDraftPersonField = useCallback((personId, field, value) => {
    setPeopleStatus('dirty');
    setCloseWarning('');
    setDraftPeople((prev) => (prev || []).map((p) => (p.id === personId ? { ...p, [field]: value } : p)));
  }, []);

  const addPerson = useCallback(() => {
    setPeopleStatus('dirty');
    setCloseWarning('');
    setDraftPeople((prev) => [...(prev || []), createEmptyPerson()]);
  }, []);
  const removePerson = useCallback((personId) => {
    setPeopleStatus('dirty');
    setCloseWarning('');
    setDraftPeople((prev) => (prev || []).filter((person) => person.id !== personId));
  }, []);

  const savePeopleSection = useCallback(() => {
    updateNode({ people: draftPeople, notes: draftSharedNotes });
    setCloseWarning('');
    setPeopleStatus('saved');
    window.setTimeout(() => setPeopleStatus('idle'), 1200);
  }, [draftPeople, draftSharedNotes, updateNode]);

  const saveStandardNodeMeta = useCallback(() => {
    updateNode({
      title: draftNodeMeta.title,
      photo: draftNodeMeta.photo,
      photoCaption: draftNodeMeta.photoCaption,
      eventDate: draftNodeMeta.eventDate,
      location: draftNodeMeta.location,
      notes: draftNodeMeta.notes
    });
    setCloseWarning('');
    setNodeMetaStatus('saved');
    window.setTimeout(() => setNodeMetaStatus('idle'), 1200);
  }, [draftNodeMeta, updateNode]);

  const saveStandardPersonSection = useCallback((patch) => {
    setCloseWarning('');
    // Commit to node data
    commitStandardPersonPatch(patch);

    // Also upsert into the savedPeople library (explicit save action)
    const merged = { ...(draftStandardPerson || createEmptyStandardPerson()), ...(patch || {}) };
    if (merged?.fullName?.trim()) {
      let nextLibrary = Array.isArray(state.savedPeople) ? state.savedPeople : [];
      nextLibrary = upsertSavedPerson(nextLibrary, merged);

      const upsertByNameAndPhoto = (name, photo) => {
        const fullName = String(name || '').trim();
        if (!fullName) return;
        nextLibrary = upsertSavedPerson(nextLibrary, { fullName, photo: String(photo || '').trim() });
      };

      const relSingles = [merged.father, merged.mother].filter(Boolean);
      relSingles.forEach((r) => {
        if (typeof r === 'string') upsertByNameAndPhoto(r, '');
        else upsertByNameAndPhoto(r?.name, r?.photo);
      });

      const relMultis = [
        merged.children,
        merged.siblings,
        merged.girlfriends,
        merged.boyfriends,
        merged.husbands,
        merged.wives,
        merged.stepFathers,
        merged.stepMothers,
        merged.fosterParents,
        merged.fosterChildren,
        merged.adoptiveParents,
        merged.adoptedChildren
      ];
      relMultis.forEach((arr) => {
        (Array.isArray(arr) ? arr : []).forEach((r) => {
          if (typeof r === 'string') upsertByNameAndPhoto(r, '');
          else upsertByNameAndPhoto(r?.name, r?.photo);
        });
      });

      dispatch({ type: ACTIONS.SET_SAVED_PEOPLE, payload: nextLibrary });
    }
  }, [commitStandardPersonPatch, dispatch, draftStandardPerson, state.savedPeople]);

  const updateHandleCount = useCallback((side, value) => updateNode({ handles: { ...(nodeData?.handles || {}), [side]: Math.max(0, Number(value) || 0) } }), [nodeData?.handles, updateNode]);
  const updateHandleLayout = useCallback((side, field, value) => updateNode({ handleLayout: { ...(nodeData?.handleLayout || {}), [side]: { ...(nodeData?.handleLayout?.[side] || {}), [field]: Math.max(0, Math.min(100, Number(value) || 0)) } } }), [nodeData?.handleLayout, updateNode]);

  const handleAutofillPerson = useCallback((personId, savedPerson) => {
    setPeopleStatus('dirty');
    setCloseWarning('');
    setDraftPeople((prev) => (prev || []).map((p) => {
      if (p.id !== personId) return p;
      return {
        ...p,
        fullName: savedPerson?.fullName || p.fullName || '',
        nickname: savedPerson?.nickname || p.nickname || '',
        photo: savedPerson?.photo || p.photo || ''
      };
    }));
  }, []);


  const handleClose = useCallback(() => {
    if (anyUnsaved) {
      setCloseWarning('This editor has unsaved changes. Save the section shown in red before closing.');
      return;
    }

    // Update savedPeople library only when closing the editor (no onChange saving)
    const currentPeople = nodeData?.people || [];
    let nextLibrary = Array.isArray(state.savedPeople) ? state.savedPeople : [];

    const upsertByNameAndPhoto = (name, photo) => {
      const fullName = String(name || '').trim();
      if (!fullName) return;
      nextLibrary = upsertSavedPerson(nextLibrary, {
        fullName,
        photo: String(photo || '').trim()
      });
    };

    // Persons Node: only minimal person cards
    currentPeople.forEach((p) => {
      if (!p) return;
      if (!p.fullName || !String(p.fullName).trim()) return;
      nextLibrary = upsertSavedPerson(nextLibrary, p);
    });

    // Standard node: full person record + relationship name/photo library upserts
    if (nodeData?.nodeType === NODE_TYPES.STANDARD && nodeData?.standardPerson?.fullName?.trim()) {
      // Snapshot node "thumbnail" fields into the person record (kept separate from the person's own photo)
      const nodeMeta = {
        title: nodeData?.title || '',
        thumbnailPhoto: nodeData?.photo || '',
        photoCaption: nodeData?.photoCaption || '',
        eventDate: nodeData?.eventDate || '',
        location: nodeData?.location || ''
      };

      const nextStandard = { ...(nodeData.standardPerson || {}), nodeMeta };
      nextLibrary = upsertSavedPerson(nextLibrary, nextStandard);

      // Relationship library upserts (name + photo only)
      const sp = nextStandard;
      const relSingles = [sp.father, sp.mother].filter(Boolean);
      relSingles.forEach((r) => {
        if (typeof r === 'string') upsertByNameAndPhoto(r, '');
        else upsertByNameAndPhoto(r?.name, r?.photo);
      });

      const relMultis = [
        sp.children,
        sp.siblings,
        sp.girlfriends,
        sp.boyfriends,
        sp.husbands,
        sp.wives,
        sp.stepFathers,
        sp.stepMothers,
        sp.fosterParents,
        sp.fosterChildren,
        sp.adoptiveParents,
        sp.adoptedChildren
      ];
      relMultis.forEach((arr) => {
        (Array.isArray(arr) ? arr : []).forEach((r) => {
          if (typeof r === 'string') upsertByNameAndPhoto(r, '');
          else upsertByNameAndPhoto(r?.name, r?.photo);
        });
      });

      // Persist the updated person back into the node before closing
      dispatch({ type: ACTIONS.UPDATE_NODE_DATA, payload: { id: selectedNode.id, data: { standardPerson: nextStandard } } });
    }

    if (nextLibrary !== state.savedPeople) {
      dispatch({ type: ACTIONS.SET_SAVED_PEOPLE, payload: nextLibrary });
    }

    dispatch({ type: ACTIONS.SET_EDITOR_UNSAVED_CHANGES, payload: false });
    dispatch({ type: ACTIONS.CLOSE_EDITOR });
  }, [anyUnsaved, dispatch, nodeData, selectedNode, state.savedPeople]);


  useEffect(() => {
    if (!selectedNode || !nodeData || !state.isEditorOpen) return;
    if ((nodeData.nodeType || NODE_TYPES.STANDARD) !== NODE_TYPES.STANDARD) return;
    if (!nodeData.standardPerson) {
      updateNode({ standardPerson: createEmptyPerson({ id: 'standard-person' }) });
    }
  }, [selectedNode, nodeData, state.isEditorOpen, updateNode]);

  // Hydrate drafts when opening editor or switching nodes/types
  useEffect(() => {
    if (!selectedNode || !nodeData || !state.isEditorOpen) return;

    setDraftNodeMeta({
      title: nodeData.title || '',
      photo: nodeData.photo || '',
      photoCaption: nodeData.photoCaption || '',
      eventDate: nodeData.eventDate || '',
      location: nodeData.location || '',
      notes: nodeData.notes || ''
    });

    setDraftSharedNotes(nodeData.notes || '');
    setDraftPeople(Array.isArray(nodeData.people) ? nodeData.people : []);
    setDraftStandardPerson(nodeData.standardPerson || createEmptyStandardPerson());
    setNodeMetaStatus('idle');
    setPeopleStatus('idle');
    setStandardStatus({ personal: 'idle', about: 'idle', relationships: 'idle' });
    setCloseWarning('');
    dispatch({ type: ACTIONS.SET_EDITOR_UNSAVED_CHANGES, payload: false });
  }, [dispatch, selectedNode?.id, nodeData?.nodeType, state.isEditorOpen]);

    const titleOptions = useMemo(() => {
    const opts = (state.savedPeople || [])
      .filter((p) => (p?.fullName || '').trim().length)
      .map((p) => ({ label: p.fullName, value: p.fullName }));
    return opts.slice(0, 15);
  }, [state.savedPeople]);

// Only render when a node is selected and the editor is open.
  // IMPORTANT: keep this guard AFTER all hooks to preserve hook order.
  if (!selectedNode || !nodeData || !state.isEditorOpen) return null;

  const isStandard = nodeData.nodeType === NODE_TYPES.STANDARD;
  const canAddPeople = nodeData.nodeType === NODE_TYPES.PERSONS;

  const primaryLabel = nodeData?.people?.[0]?.fullName || 'the primary person';

  return (
    <Drawer
      open={state.isEditorOpen}
      onClose={handleClose}
      keyboard={!anyUnsaved}
      backdrop={anyUnsaved ? 'static' : true}
      size="sm"
      className={styles.drawer}
    >
      <Drawer.Header><Drawer.Title>Edit Family Node</Drawer.Title></Drawer.Header>
      <Drawer.Body className={styles.body}>
        <div className={styles.note}>Type freely. Use the Save buttons at the bottom of each section to apply changes.</div>
        {closeWarning ? <div className={styles.warningNote}>{closeWarning}</div> : null}
        <Form fluid>
          <Form.Group controlId="node-type">
            <Form.ControlLabel>Node type</Form.ControlLabel>
            <SelectPicker block cleanable={false} searchable={false} data={NODE_TYPE_OPTIONS} value={nodeData.nodeType || NODE_TYPES.STANDARD} onChange={updateNodeType} />
          </Form.Group>

          <Form.Group controlId="node-title">
            <Form.ControlLabel>Title</Form.ControlLabel>
            <InputPicker
              block
              data={titleOptions}
              value={draftNodeMeta.title}
              onChange={(value) => { setNodeMetaStatus('dirty'); setCloseWarning(''); setDraftNodeMeta((prev) => ({ ...prev, title: value || '' })); }}
              placeholder="Type a title or pick a name"
              searchable
              creatable
              cleanable
            />
          </Form.Group>

          {isStandard && (
            <>
              <Form.Group controlId="node-photo">
                <Form.ControlLabel>Image URL or Data URL</Form.ControlLabel>
                <Form.Control name="photo" value={draftNodeMeta.photo} onChange={(value) => { setNodeMetaStatus('dirty'); setCloseWarning(''); setDraftNodeMeta((prev) => ({ ...prev, photo: value })); }} />
              </Form.Group>
              <Form.Group controlId="photo-caption"><Form.ControlLabel>Image caption</Form.ControlLabel><Form.Control name="photoCaption" value={draftNodeMeta.photoCaption} onChange={(value) => { setNodeMetaStatus('dirty'); setCloseWarning(''); setDraftNodeMeta((prev) => ({ ...prev, photoCaption: value })); }} /></Form.Group>
              <Form.Group controlId="event-date"><Form.ControlLabel>Event date</Form.ControlLabel><Form.Control accepter={Input} name="eventDate" type="date" value={draftNodeMeta.eventDate} onChange={(value) => { setNodeMetaStatus('dirty'); setCloseWarning(''); setDraftNodeMeta((prev) => ({ ...prev, eventDate: value })); }} /></Form.Group>
              <Form.Group controlId="location"><Form.ControlLabel>Location</Form.ControlLabel><Form.Control name="location" value={draftNodeMeta.location} onChange={(value) => { setNodeMetaStatus('dirty'); setCloseWarning(''); setDraftNodeMeta((prev) => ({ ...prev, location: value })); }} /></Form.Group>
              <Form.Group controlId="notes"><Form.ControlLabel>Notes</Form.ControlLabel><Input as="textarea" rows={3} value={draftNodeMeta.notes} onChange={(value) => { setNodeMetaStatus('dirty'); setCloseWarning(''); setDraftNodeMeta((prev) => ({ ...prev, notes: value })); }} /></Form.Group>

              <Button appearance="primary" onClick={saveStandardNodeMeta} className={`${styles.saveBtn} ${nodeMetaStatus === 'dirty' ? styles.saveBtnDirty : nodeMetaStatus === 'saved' ? styles.saveBtnSaved : ''}`}>{nodeMetaStatus === 'saved' ? 'Saved ✓' : 'Save node details'}</Button>

              <Divider>Person details</Divider>
              <StandardPersonFields
                onStatusChange={(nextStatus) => {
                  setStandardStatus(nextStatus);
                  if (Object.values(nextStatus || {}).includes('dirty')) setCloseWarning('');
                }}
                savedPeople={state.savedPeople || []}
                onAutofillPerson={handleAutofillStandardPerson}
                person={draftStandardPerson}
                setPerson={setDraftStandardPerson}
                onSaveSection={saveStandardPersonSection}
              />
            </>
          )}

          {!isStandard && (
            <>
              <Divider>People in this node</Divider>
              {(draftPeople || []).map((person, index) => (
                <PersonFields
                savedPeople={state.savedPeople || []}
                onAutofillPerson={handleAutofillPerson}
                  key={person.id}
                  person={person}
                  index={index}
                  onChange={updateDraftPersonField}
                  onRemove={removePerson}
                  canRemove={canAddPeople && (draftPeople || []).length > 1}
                                  />
              ))}
              {canAddPeople && <Button appearance="ghost" onClick={addPerson}>Add another person</Button>}
              <Divider>Shared notes</Divider>
              <Form.Group controlId="notes-shared"><Form.ControlLabel>Notes</Form.ControlLabel>
              <Input as="textarea" rows={3} value={draftSharedNotes} onChange={(value) => { setPeopleStatus('dirty'); setCloseWarning(''); setDraftSharedNotes(value); }} />
              </Form.Group>

              <Button appearance="primary" onClick={savePeopleSection} className={`${styles.saveBtn} ${peopleStatus === 'dirty' ? styles.saveBtnDirty : peopleStatus === 'saved' ? styles.saveBtnSaved : ''}`}>{peopleStatus === 'saved' ? 'Saved ✓' : 'Save people'}</Button>
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
