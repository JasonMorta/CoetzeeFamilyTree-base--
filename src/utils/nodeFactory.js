import { createId } from './id';

// Central node type registry.
export const NODE_TYPES = {
  STANDARD: 'standardPhoto',
  PERSONS: 'persons'
};


export function createDefaultImageSettings() {
  return {
    nodeImageSize: 'cover',
    nodeImageRepeat: 'no-repeat',
    nodeImagePosition: 'center center',
    personImageSize: 72
  };
}

export function createEmptyPerson(overrides = {}) {
  // Minimal person card used in "Persons Node" (multi-person nodes)
  return {
    id: createId('person'),
    fullName: '',
    nickname: '',
    photo: '',
    ...overrides
  };
}

export function createEmptyStandardPerson(overrides = {}) {
  // Detailed person record used by the Standard Person Photo Node (single person nodes)
  return {
    id: 'standard-person',
    fullName: '',
    nickname: '',
    photo: '',

    // Personal details
    prefix: '',
    maidenName: '',

    // About this person
    birthDate: '',
    birthPlace: '',
    stillAlive: false,
    deathDate: '',
    deathPlace: '',
    occupation: '',
    address: '',
    contactNumber: '',
    moreInfo: '',

    // Relationships (name + photo only)
    father: { name: '', photo: '' },
    mother: { name: '', photo: '' },
    children: [],

    girlfriends: [],
    boyfriends: [],
    husbands: [],
    wives: [],

    stepFathers: [],
    stepMothers: [],
    fosterParents: [],
    fosterChildren: [],
    adoptiveParents: [],
    adoptedChildren: [],

    siblings: [],

    // Hidden-field toggles for modal rendering
    hiddenFields: {
      father: true,
      mother: true,
      children: true,
      girlfriends: true,
      boyfriends: true,
      husbands: true,
      wives: true,
      stepFathers: true,
      stepMothers: true,
      fosterParents: true,
      fosterChildren: true,
      adoptiveParents: true,
      adoptedChildren: true,
      siblings: true
    },

    // Optional: node thumbnail metadata snapshot
    nodeMeta: {
      title: '',
      thumbnailPhoto: '',
      photoCaption: '',
      eventDate: '',
      location: ''
    },

    ...overrides
  };
}



export function createDefaultPeopleByType(nodeType = NODE_TYPES.STANDARD) {
  if (nodeType === NODE_TYPES.PERSONS) {
    return [createEmptyPerson()];
  }
  return [];
}

export function createDefaultHandles() {
  return {
    top: 0,
    right: 0,
    bottom: 1,
    left: 0
  };
}

export function createDefaultHandleLayout() {
  return {
    top: { anchor: 50, spread: 40 },
    right: { anchor: 50, spread: 40 },
    bottom: { anchor: 50, spread: 40 },
    left: { anchor: 50, spread: 40 }
  };
}

export function sanitizeHandleCounts(handles = {}) {
  return {
    top: Math.max(0, Number(handles.top) || 0),
    right: Math.max(0, Number(handles.right) || 0),
    bottom: Math.max(0, Number(handles.bottom) || 0),
    left: Math.max(0, Number(handles.left) || 0)
  };
}

export function sanitizeHandleLayout(layout = {}) {
  const defaults = createDefaultHandleLayout();
  const result = {};

  Object.keys(defaults).forEach((side) => {
    result[side] = {
      anchor: clampPercent(layout?.[side]?.anchor ?? defaults[side].anchor),
      spread: clampPercent(layout?.[side]?.spread ?? defaults[side].spread)
    };
  });

  return result;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function clampSize(value) {
  return Math.max(100, Math.min(800, Number(value) || 220));
}

function clampRadius(value) {
  return Math.max(8, Math.min(36, Number(value) || 18));
}

export function createNodeData() {
  return {
    nodeType: NODE_TYPES.STANDARD,
    title: 'New Family Node',
    photo: '',
    photoCaption: '',
    location: '',
    eventDate: '',
    notes: '',
    tags: '',
    nodeWidth: 220,
    nodeHeight: 220,
    nodeRadius: 18,
    handles: createDefaultHandles(),
    handleLayout: createDefaultHandleLayout(),
    imageSettings: createDefaultImageSettings(),
    people: [],
    // Standard nodes carry a single primary person record for metadata (does not affect canvas rendering)
    standardPerson: createEmptyStandardPerson()
  };
}

export function normalizePersonRecord(person = {}) {
  const base = createEmptyPerson({ id: person.id || createId('person') });
  const cleaned = { ...person };
  // Strip legacy / unsupported fields
  delete cleaned.relationLabel;
  delete cleaned.biography;
  delete cleaned.gender;
  delete cleaned.confidence;
  delete cleaned.sources;
  delete cleaned.residence;
  delete cleaned.burialPlace;
  delete cleaned.parents;
  delete cleaned.children;
  delete cleaned.parentLinks;
  delete cleaned.childLinks;

  return {
    ...base,
    ...cleaned
  };
}


function normalizeRelSingle(value) {
  if (!value) return { name: '', photo: '' };
  if (typeof value === 'string') return { name: value, photo: '' };
  return {
    name: String(value.name || ''),
    photo: String(value.photo || '')
  };
}

function normalizeRelMulti(value) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [];
  return arr
    .map((v) => {
      if (!v) return null;
      if (typeof v === 'string') return { name: v, photo: '' };
      return { name: String(v.name || ''), photo: String(v.photo || '') };
    })
    .filter(Boolean)
    .filter((v) => v.name.trim().length > 0);
}

function normalizeStandardPerson(person = {}) {
  const base = createEmptyStandardPerson();
  const hiddenFields = {
    ...(base.hiddenFields || {}),
    ...((typeof person.hiddenFields === 'object' && person.hiddenFields) ? person.hiddenFields : {})
  };
  const moreInfo = person.moreInfo ?? person.biography ?? '';
  const stillAlive = Boolean(person.stillAlive);
  const address = person.address ?? person.residence ?? '';

  const cleaned = { ...person };
  // Strip legacy / unsupported fields
  delete cleaned.relationLabel;
  delete cleaned.biography;
  delete cleaned.gender;
  delete cleaned.confidence;
  delete cleaned.sources;
  delete cleaned.burialPlace;
  delete cleaned.residence;
  delete cleaned.parents;
  delete cleaned.parentLinks;
  delete cleaned.childLinks;
  delete cleaned.fosterFathers;
  delete cleaned.fosterMothers;
  delete cleaned.adoptiveFathers;
  delete cleaned.adoptiveMothers;

  const nodeMeta = {
    ...base.nodeMeta,
    ...(typeof person.nodeMeta === 'object' && person.nodeMeta ? person.nodeMeta : {})
  };

  return {
    ...base,
    ...cleaned,
    address,
    stillAlive,
    moreInfo,
    hiddenFields,

    // Relationships
    father: normalizeRelSingle(person.father),
    mother: normalizeRelSingle(person.mother),
    children: normalizeRelMulti(person.children),

    girlfriends: normalizeRelMulti(person.girlfriends),
    boyfriends: normalizeRelMulti(person.boyfriends),
    husbands: normalizeRelMulti(person.husbands),
    wives: normalizeRelMulti(person.wives),

    stepFathers: normalizeRelMulti(person.stepFathers),
    stepMothers: normalizeRelMulti(person.stepMothers),
    fosterParents: normalizeRelMulti(
      person.fosterParents ?? [...(person.fosterFathers ?? []), ...(person.fosterMothers ?? [])]
    ),
    fosterChildren: normalizeRelMulti(person.fosterChildren ?? []),
    adoptiveParents: normalizeRelMulti(
      person.adoptiveParents ?? [...(person.adoptiveFathers ?? []), ...(person.adoptiveMothers ?? [])]
    ),
    adoptedChildren: normalizeRelMulti(person.adoptedChildren ?? []),

    siblings: normalizeRelMulti(person.siblings ?? []),

    nodeMeta
  };
}



function clonePeople(people = []) {
  return people.map((person, index) => ({
    ...createEmptyPerson({ relationshipToPrimary: index === 0 ? 'primary' : 'other' }),
    ...person,
    id: person.id || createId('person')
  }));
}

function normalizeParentsPeople(people = []) {
  const current = people?.length ? clonePeople(people) : createDefaultPeopleByType(nodeType);
  if (!current.length) {
    current.push(createEmptyPerson({ relationshipToPrimary: 'primary' }));
  }

  current[0] = {
    ...current[0],
    relationshipToPrimary: 'primary'
  };

  return current.map((person, index) => ({
    ...person,
    relationshipToPrimary: index === 0 ? 'primary' : person.relationshipToPrimary || 'other'
  }));
}

function normalizePeople(nodeType, people) {
  const current = people?.length ? clonePeople(people) : createDefaultPeopleByType(nodeType);

  
  if (nodeType === NODE_TYPES.STANDARD) {
    return [];
  }

  return current;
}

export function normalizeNodeData(data = {}) {
  const defaults = createNodeData();
  const nodeType = [NODE_TYPES.STANDARD, NODE_TYPES.PERSONS].includes(data.nodeType)
    ? data.nodeType
    : defaults.nodeType;

  return {
    ...defaults,
    ...data,
    nodeType,
    nodeWidth: clampSize(data.nodeWidth ?? defaults.nodeWidth),
    nodeHeight: clampSize(data.nodeHeight ?? defaults.nodeHeight),
    nodeRadius: clampRadius(data.nodeRadius ?? defaults.nodeRadius),
    handles: sanitizeHandleCounts(data.handles || defaults.handles),
    handleLayout: sanitizeHandleLayout(data.handleLayout || defaults.handleLayout),
    imageSettings: {
      ...createDefaultImageSettings(),
      ...(data.imageSettings || {})
    },
    people: normalizePeople(nodeType, data.people),
    standardPerson: normalizeStandardPerson(data.standardPerson || {})
  };
}

export function createFamilyNode(position = { x: 250, y: 180 }, dataOverrides = {}) {
  return {
    id: createId('node'),
    type: 'familyNode',
    position,
    data: normalizeNodeData(dataOverrides)
  };
}

export function duplicateFamilyNode(node, offset = { x: 40, y: 40 }) {
  const clonedData = normalizeNodeData(node.data || {});
  clonedData.people = (clonedData.people || []).map((person) => ({ ...person, id: createId('person') }));

  return {
    id: createId('node'),
    type: node.type || 'familyNode',
    position: {
      x: node.position.x + offset.x,
      y: node.position.y + offset.y
    },
    data: clonedData
  };
}
