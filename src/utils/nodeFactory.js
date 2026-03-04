import { createId } from './id';

// Central node type registry. We keep a legacy alias for older saved trees
// so previous "married" nodes can load into the new Parents node model.
export const NODE_TYPES = {
  STANDARD: 'standardPhoto',
  PERSONS: 'persons',
  PARENTS: 'parents',
  MARRIED_LEGACY: 'married'
};

export const RELATIONSHIP_OPTIONS = [
  { label: 'Primary person', value: 'primary' },
  { label: 'Spouse', value: 'spouse' },
  { label: 'Partner', value: 'partner' },
  { label: 'Ex-spouse', value: 'exSpouse' },
  { label: 'Ex-partner', value: 'exPartner' },
  { label: 'Boyfriend / Girlfriend', value: 'boyfriendGirlfriend' },
  { label: 'Co-parent', value: 'coParent' },
  { label: 'Other', value: 'other' }
];

export function createDefaultImageSettings() {
  return {
    nodeImageSize: 'cover',
    nodeImageRepeat: 'no-repeat',
    nodeImagePosition: 'center center',
    personImageSize: 72
  };
}

export function createEmptyPerson(overrides = {}) {
  return {
    id: createId('person'),
    fullName: '',
    nickname: '',
    photo: '',
    birthDate: '',
    deathDate: '',
    relationLabel: '',
    occupation: '',
    biography: '',
    relationshipToPrimary: 'other',
    relationshipNotes: '',
    ...overrides
  };
}

export function createDefaultPeopleByType(nodeType = NODE_TYPES.STANDARD) {
  if (nodeType === NODE_TYPES.PERSONS) {
    return [createEmptyPerson()];
  }
  if (nodeType === NODE_TYPES.PARENTS || nodeType === NODE_TYPES.MARRIED_LEGACY) {
    return [
      createEmptyPerson({ relationshipToPrimary: 'primary' }),
      createEmptyPerson({ relationshipToPrimary: 'spouse' })
    ];
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
    people: []
  };
}

export function clonePeople(people = []) {
  return people.map((person, index) => ({
    ...createEmptyPerson({ relationshipToPrimary: index === 0 ? 'primary' : 'other' }),
    ...person,
    id: person.id || createId('person')
  }));
}

function normalizeParentsPeople(people = []) {
  const current = people?.length ? clonePeople(people) : createDefaultPeopleByType(NODE_TYPES.PARENTS);
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

  if (nodeType === NODE_TYPES.PARENTS || nodeType === NODE_TYPES.MARRIED_LEGACY) {
    return normalizeParentsPeople(current);
  }

  if (nodeType === NODE_TYPES.STANDARD) {
    return [];
  }

  return current;
}

export function normalizeNodeData(data = {}) {
  const defaults = createNodeData();
  const requestedType = data.nodeType === NODE_TYPES.MARRIED_LEGACY ? NODE_TYPES.PARENTS : data.nodeType;
  const nodeType = [NODE_TYPES.STANDARD, NODE_TYPES.PERSONS, NODE_TYPES.PARENTS].includes(requestedType)
    ? requestedType
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
    people: normalizePeople(nodeType, data.people)
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
