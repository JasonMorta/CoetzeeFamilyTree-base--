import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { Drawer, Button, Form, Divider, Slider, Grid, Row, Col, SelectPicker, Input, Checkbox } from 'rsuite';
import styles from './NodeEditorDrawer.module.css';
import { useAppState } from '../../context/AppStateContext';
import { ACTIONS } from '../../context/appReducer';
import PersonFields from './PersonFields';
import StandardPersonFields from './StandardPersonFields';
import { createEmptyPerson, createEmptyStandardPerson, NODE_TYPES, createDefaultPeopleByType } from '../../utils/nodeFactory';
import { updateFirebasePersonRecord } from '../../services/firebasePeopleService';
import {
  createStandardPersonWrapper,
  getRecordName,
  getRecordPhoto,
  getRecordNickname,
  normalizeSavedPersonRecord,
  normalizeSavedPeopleCollection,
  standardPersonToSavedRecord,
  createEmptySavedPersonRecord,
  syncNodeDetailsWithPerson,
  personRecordToLinkedDraft,
  linkedPersonDraftToSavedRecord
} from '../../utils/family3Schema';
import { buildFamily3EditLink } from '../../utils/family3FormUrl';

function normalizeFullName(name) {
  return (name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function upsertSavedPerson(library, personRecord) {
  const normalized = normalizeSavedPersonRecord(personRecord);
  const key = normalizeFullName(getRecordName(normalized));
  if (!key) return Array.isArray(library) ? library : [];
  const next = normalizeSavedPeopleCollection(library || []);
  const idx = next.findIndex((p) => normalizeFullName(getRecordName(p)) === key);
  if (idx >= 0) {
    next[idx] = normalizeSavedPersonRecord({
      person: {
        ...next[idx].person,
        ...normalized.person,
        submissionMeta: {
          ...(next[idx].person?.submissionMeta || {}),
          ...(normalized.person?.submissionMeta || {})
        },
        relationships: {
          ...(next[idx].person?.relationships || {}),
          ...(normalized.person?.relationships || {})
        },
        node: {
          ...(next[idx].person?.node || {}),
          ...(normalized.person?.node || {})
        }
      }
    });
    return next;
  }
  next.push(normalized);
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

async function copyTextToClipboard(value) {
  const text = String(value || '').trim();
  if (!text) return false;

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return copied;
}

export default function NodeEditorDrawer() {
  const { state, dispatch } = useAppState();
  const selectedNode = useMemo(() => state.nodes.find((node) => node.id === state.selectedNodeId), [state.nodes, state.selectedNodeId]);
  const nodeData = selectedNode?.data;

  const [draftStandardPerson, setDraftStandardPerson] = useState(createEmptyStandardPerson());
  const [peopleStatus, setPeopleStatus] = useState('idle');
  const [standardStatus, setStandardStatus] = useState({ personal: 'idle', node: 'idle', relationships: 'idle' });
  const [closeWarning, setCloseWarning] = useState('');
  const [draftPeople, setDraftPeople] = useState([]);
  const [draftSharedNotes, setDraftSharedNotes] = useState('');
  const [draftNodeType, setDraftNodeType] = useState(NODE_TYPES.STANDARD);
  const [draftPeopleNodeDisplaySingleImage, setDraftPeopleNodeDisplaySingleImage] = useState(false);
  const [draftPeopleNodeSingleImageUrl, setDraftPeopleNodeSingleImageUrl] = useState('');
  const [draftPeopleNodeSingleImageTitle, setDraftPeopleNodeSingleImageTitle] = useState('');
  const [generatedEditLink, setGeneratedEditLink] = useState('');
  const [editLinkStatus, setEditLinkStatus] = useState('');

  const currentNodeType = nodeData?.nodeType || NODE_TYPES.STANDARD;
  const hasDraftNodeTypeChange = draftNodeType !== currentNodeType;
  const hasDraftPeopleDisplayChange = draftPeopleNodeDisplaySingleImage !== Boolean(nodeData?.peopleNodeDisplaySingleImage)
    || draftPeopleNodeSingleImageUrl !== String(nodeData?.peopleNodeSingleImageUrl || '')
    || draftPeopleNodeSingleImageTitle !== String(nodeData?.peopleNodeSingleImageTitle || '');
  const anyUnsaved = useMemo(() => hasDraftNodeTypeChange || hasDraftPeopleDisplayChange || [peopleStatus, ...Object.values(standardStatus || {})].includes('dirty'), [hasDraftNodeTypeChange, hasDraftPeopleDisplayChange, peopleStatus, standardStatus]);

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
    setCloseWarning('');
    setDraftNodeType(nextType);

    if (nextType === NODE_TYPES.PERSONS && (!draftPeople || draftPeople.length === 0)) {
      setDraftPeople(createDefaultPeopleByType(NODE_TYPES.PERSONS));
    }

    if (nextType === NODE_TYPES.PERSONS) {
      setPeopleStatus('dirty');
    } else {
      setStandardStatus({ personal: 'dirty', node: 'dirty', relationships: 'dirty' });
    }
  }, [draftPeople]);

  const commitStandardPerson = useCallback((nextStandard) => {
    updateNode({ standardPerson: createStandardPersonWrapper(nextStandard) });
  }, [updateNode]);

  const saveStandardRecordToLibrary = useCallback((record) => {
    const savedRecord = standardPersonToSavedRecord(record);
    if (!getRecordName(savedRecord).trim()) return;

    let nextLibrary = Array.isArray(state.savedPeople) ? state.savedPeople : [];
    nextLibrary = upsertSavedPerson(nextLibrary, savedRecord);

    ['parents', 'children', 'siblings', 'partners'].forEach((groupKey) => {
      (savedRecord.person?.relationships?.[groupKey] || []).forEach((entry) => {
        const name = String(entry?.name || '').trim();
        if (!name) return;
        nextLibrary = upsertSavedPerson(nextLibrary, {
          person: {
            ...createEmptySavedPersonRecord().person,
            name,
            birthDate: entry.birthDate || '',
            photo: entry.photo || '',
            node: {
              ...createEmptySavedPersonRecord().person.node,
              title: name,
              coverImage: entry.photo || ''
            }
          }
        });
      });
    });

    dispatch({ type: ACTIONS.SET_SAVED_PEOPLE, payload: nextLibrary });

    if (savedRecord.firebaseDocumentId) {
      void updateFirebasePersonRecord(savedRecord.firebaseDocumentId, savedRecord).catch((error) => {
        console.error('Failed to update Firebase person record from the node editor.', error);
      });
    }
  }, [dispatch, state.savedPeople]);

  const handleAutofillStandardPerson = useCallback((_, savedPerson) => {
    setDraftStandardPerson(createStandardPersonWrapper(savedPerson));
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
    updateNode({
      nodeType: NODE_TYPES.PERSONS,
      people: draftPeople,
      notes: draftSharedNotes,
      peopleNodeDisplaySingleImage: draftPeopleNodeDisplaySingleImage,
      peopleNodeSingleImageUrl: draftPeopleNodeDisplaySingleImage ? draftPeopleNodeSingleImageUrl : '',
      peopleNodeSingleImageTitle: draftPeopleNodeDisplaySingleImage ? draftPeopleNodeSingleImageTitle : '',
      standardPerson: createEmptyStandardPerson()
    });

    setDraftNodeType(NODE_TYPES.PERSONS);

    let nextLibrary = Array.isArray(state.savedPeople) ? state.savedPeople : [];
    (draftPeople || []).forEach((person) => {
      const name = String(person?.fullName || '').trim();
      if (!name) return;

      nextLibrary = upsertSavedPerson(nextLibrary, linkedPersonDraftToSavedRecord(person));
    });

    dispatch({ type: ACTIONS.SET_SAVED_PEOPLE, payload: nextLibrary });
    setCloseWarning('');
    setPeopleStatus('saved');
    window.setTimeout(() => setPeopleStatus('idle'), 1200);
  }, [dispatch, draftPeople, draftPeopleNodeDisplaySingleImage, draftPeopleNodeSingleImageTitle, draftPeopleNodeSingleImageUrl, draftSharedNotes, state.savedPeople, updateNode]);

  const saveStandardPersonSection = useCallback((nextStandard) => {
    const normalized = createStandardPersonWrapper(nextStandard);
    const syncedNode = syncNodeDetailsWithPerson(normalized.node, normalized.person);
    const withNode = createStandardPersonWrapper({ ...normalized, node: syncedNode });
    setDraftStandardPerson(withNode);
    setCloseWarning('');
    commitStandardPerson(withNode);
    updateNode({
      nodeType: NODE_TYPES.STANDARD,
      title: syncedNode.title,
      photo: syncedNode.coverImage,
      photoCaption: syncedNode.imageCaption,
      eventDate: syncedNode.eventDate,
      location: syncedNode.location,
      notes: syncedNode.notes,
      hideNodeDetailsFromModule: Boolean(syncedNode.hideFromModule),
      people: [],
      peopleNodeDisplaySingleImage: false,
      peopleNodeSingleImageUrl: '',
      peopleNodeSingleImageTitle: ''
    });
    setDraftNodeType(NODE_TYPES.STANDARD);
    setDraftPeople([]);
    setDraftPeopleNodeDisplaySingleImage(false);
    setDraftPeopleNodeSingleImageUrl('');
    setDraftPeopleNodeSingleImageTitle('');
    saveStandardRecordToLibrary(withNode);
  }, [commitStandardPerson, saveStandardRecordToLibrary, updateNode]);

  const updateHandleCount = useCallback((side, value) => updateNode({ handles: { ...(nodeData?.handles || {}), [side]: Math.max(0, Number(value) || 0) } }), [nodeData?.handles, updateNode]);
  const updateHandleLayout = useCallback((side, field, value) => updateNode({ handleLayout: { ...(nodeData?.handleLayout || {}), [side]: { ...(nodeData?.handleLayout?.[side] || {}), [field]: Math.max(0, Math.min(100, Number(value) || 0)) } } }), [nodeData?.handleLayout, updateNode]);

  const handleAutofillPerson = useCallback((personId, savedPerson) => {
    setPeopleStatus('dirty');
    setCloseWarning('');
    setDraftPeople((prev) => (prev || []).map((p) => {
      if (p.id !== personId) return p;
      const linked = personRecordToLinkedDraft(savedPerson, { id: p.id });
      return {
        ...p,
        ...linked,
        id: p.id,
        fullName: linked.fullName || p.fullName || '',
        nickname: linked.nickname || p.nickname || '',
        birthDate: linked.birthDate || p.birthDate || '',
        photo: linked.photo || p.photo || ''
      };
    }));
  }, []);

  const handleClose = useCallback(() => {
    if (anyUnsaved) {
      setCloseWarning('This editor has unsaved changes. Save the highlighted section before closing.');
      return;
    }

    let nextLibrary = Array.isArray(state.savedPeople) ? state.savedPeople : [];

    (nodeData?.people || []).forEach((person) => {
      if (!person?.fullName?.trim()) return;
      nextLibrary = upsertSavedPerson(nextLibrary, linkedPersonDraftToSavedRecord(person));
    });

    if (nodeData?.nodeType === NODE_TYPES.STANDARD) {
      const existingStandard = createStandardPersonWrapper(nodeData.standardPerson);
      const nextStandard = createStandardPersonWrapper(existingStandard, {
        node: {
          ...(existingStandard.node || {}),
          title: nodeData?.title || existingStandard.node?.title || '',
          coverImage: nodeData?.photo || existingStandard.node?.coverImage || '',
          imageCaption: nodeData?.photoCaption || existingStandard.node?.imageCaption || '',
          eventDate: nodeData?.eventDate || existingStandard.node?.eventDate || '',
          location: nodeData?.location || existingStandard.node?.location || '',
          notes: nodeData?.notes || existingStandard.node?.notes || '',
          hideFromModule: Boolean(nodeData?.hideNodeDetailsFromModule || existingStandard.node?.hideFromModule)
        }
      });
      if (getRecordName(nextStandard).trim()) {
        nextLibrary = upsertSavedPerson(nextLibrary, standardPersonToSavedRecord(nextStandard));
      }
      dispatch({ type: ACTIONS.UPDATE_NODE_DATA, payload: { id: selectedNode.id, data: { standardPerson: nextStandard } } });
    }

    dispatch({ type: ACTIONS.SET_SAVED_PEOPLE, payload: nextLibrary });
    dispatch({ type: ACTIONS.SET_EDITOR_UNSAVED_CHANGES, payload: false });
    dispatch({ type: ACTIONS.CLOSE_EDITOR });
  }, [anyUnsaved, dispatch, nodeData, selectedNode?.id, state.savedPeople]);

  useEffect(() => {
    if (!selectedNode || !nodeData || !state.isEditorOpen) return;
    if ((nodeData.nodeType || NODE_TYPES.STANDARD) !== NODE_TYPES.STANDARD) return;
    if (!nodeData.standardPerson) {
      updateNode({ standardPerson: createEmptyStandardPerson() });
    }
  }, [nodeData, selectedNode, state.isEditorOpen, updateNode]);

  useEffect(() => {
    if (!selectedNode || !nodeData || !state.isEditorOpen) return;

    setDraftNodeType(nodeData.nodeType || NODE_TYPES.STANDARD);
    setDraftSharedNotes(nodeData.notes || '');
    setDraftPeople(Array.isArray(nodeData.people) ? nodeData.people : []);
    setDraftPeopleNodeDisplaySingleImage(Boolean(nodeData.peopleNodeDisplaySingleImage));
    setDraftPeopleNodeSingleImageUrl(String(nodeData.peopleNodeSingleImageUrl || ''));
    setDraftPeopleNodeSingleImageTitle(String(nodeData.peopleNodeSingleImageTitle || ''));
    const existingStandard = createStandardPersonWrapper(nodeData.standardPerson || createEmptyStandardPerson());
    setDraftStandardPerson(createStandardPersonWrapper(existingStandard, {
      node: {
        ...(existingStandard.node || {}),
        title: nodeData.title || existingStandard.node?.title || '',
        coverImage: nodeData.photo || existingStandard.node?.coverImage || '',
        imageCaption: nodeData.photoCaption || existingStandard.node?.imageCaption || '',
        eventDate: nodeData.eventDate || existingStandard.node?.eventDate || '',
        location: nodeData.location || existingStandard.node?.location || '',
        notes: nodeData.notes || existingStandard.node?.notes || '',
        hideFromModule: Boolean(nodeData.hideNodeDetailsFromModule || existingStandard.node?.hideFromModule)
      }
    }));
    setPeopleStatus('idle');
    setStandardStatus({ personal: 'idle', node: 'idle', relationships: 'idle' });
    setCloseWarning('');
    setGeneratedEditLink('');
    setEditLinkStatus('');
    dispatch({ type: ACTIONS.SET_EDITOR_UNSAVED_CHANGES, payload: false });
  }, [dispatch, selectedNode?.id, state.isEditorOpen]);

  if (!selectedNode || !nodeData || !state.isEditorOpen) return null;

  const isStandard = draftNodeType === NODE_TYPES.STANDARD;
  const canAddPeople = draftNodeType === NODE_TYPES.PERSONS;
  const standardExternalEditId = String(draftStandardPerson?.firebaseDocumentId || nodeData?.standardPerson?.firebaseDocumentId || '').trim();
  const canGenerateExternalEditLink = isStandard && Boolean(standardExternalEditId);

  const handleGenerateExternalEditLink = async () => {
    const nextLink = buildFamily3EditLink(standardExternalEditId);
    if (!nextLink) {
      setGeneratedEditLink('');
      setEditLinkStatus('This person needs a saved external edit ID before a form edit link can be generated.');
      return;
    }

    setGeneratedEditLink(nextLink);
    try {
      const copied = await copyTextToClipboard(nextLink);
      setEditLinkStatus(copied ? 'Edit link copied to clipboard.' : 'Edit link generated. Copy it from the field below.');
    } catch (error) {
      setEditLinkStatus('Edit link generated. Copy it from the field below.');
    }
  };

  return (
    <Drawer open={state.isEditorOpen} onClose={handleClose} keyboard={!anyUnsaved} backdrop={anyUnsaved ? 'static' : true} size="sm" className={styles.drawer}>
      <Drawer.Header><Drawer.Title>Edit Family Node</Drawer.Title></Drawer.Header>
      <Drawer.Body className={styles.body}>
        <div className={styles.note}>Type freely. Use the save buttons inside each section to apply changes before closing.</div>
        {closeWarning ? <div className={styles.warningNote}>{closeWarning}</div> : null}
        <Form fluid>
          <Form.Group controlId="node-type">
            <Form.ControlLabel>Node type</Form.ControlLabel>
            <SelectPicker block cleanable={false} searchable={false} data={NODE_TYPE_OPTIONS} value={draftNodeType || NODE_TYPES.STANDARD} onChange={updateNodeType} />
          </Form.Group>

          {isStandard && (
            <>
              <Divider>Person and node details</Divider>
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
              <div className={styles.externalLinkPanel}>
                <div className={styles.externalLinkTitle}>External edit link</div>
                <div className={styles.externalLinkText}>Generate a Family3 form link for this node. It uses the saved external edit ID so the form can open directly in edit mode for this person.</div>
                <div className={styles.externalLinkRow}>
                  <Button appearance="ghost" onClick={() => void handleGenerateExternalEditLink()} disabled={!canGenerateExternalEditLink}>Generate edit link</Button>
                  <Input value={generatedEditLink} readOnly placeholder={canGenerateExternalEditLink ? 'Generated edit link will appear here.' : 'Save/import this person with an external edit ID first.'} />
                </div>
                {editLinkStatus ? <div className={styles.externalLinkStatus}>{editLinkStatus}</div> : null}
              </div>
            </>
          )}

          {!isStandard && (
            <>
              <Divider>Persons node display</Divider>
              <Form.Group controlId="people-node-single-image-toggle">
                <Checkbox
                  checked={draftPeopleNodeDisplaySingleImage}
                  onChange={(_, checked) => {
                    setPeopleStatus('dirty');
                    setCloseWarning('');
                    setDraftPeopleNodeDisplaySingleImage(Boolean(checked));
                    if (!checked) {
                      setDraftPeopleNodeSingleImageUrl('');
                      setDraftPeopleNodeSingleImageTitle('');
                    }
                  }}
                >
                  Only display one image on the node
                </Checkbox>
              </Form.Group>
              {draftPeopleNodeDisplaySingleImage ? (
                <>
                  <Form.Group controlId="people-node-single-image-url">
                    <Form.ControlLabel>Display image URL</Form.ControlLabel>
                    <Input
                      value={draftPeopleNodeSingleImageUrl}
                      onChange={(value) => { setPeopleStatus('dirty'); setCloseWarning(''); setDraftPeopleNodeSingleImageUrl(value || ''); }}
                      placeholder="Paste the image URL to show on the node"
                    />
                  </Form.Group>
                  <Form.Group controlId="people-node-single-image-title">
                    <Form.ControlLabel>Display image title</Form.ControlLabel>
                    <Input
                      value={draftPeopleNodeSingleImageTitle}
                      onChange={(value) => { setPeopleStatus('dirty'); setCloseWarning(''); setDraftPeopleNodeSingleImageTitle(value || ''); }}
                      placeholder="Add the title to show under the node image"
                    />
                  </Form.Group>
                </>
              ) : null}

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
              <Form.Group controlId="notes-shared"><Form.ControlLabel>Notes</Form.ControlLabel><Input as="textarea" rows={3} value={draftSharedNotes} onChange={(value) => { setPeopleStatus('dirty'); setCloseWarning(''); setDraftSharedNotes(value || ''); }} /></Form.Group>
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
              <Col xs={24} sm={12}><SliderField label="Person image size" value={nodeData.imageSettings?.personImageSize ?? 72} min={44} max={140} onChange={(value) => updateImageSetting('personImageSize', value)} help="Used by People nodes inside the canvas card." /></Col>
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
