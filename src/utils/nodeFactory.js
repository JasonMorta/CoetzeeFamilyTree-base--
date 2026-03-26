import { createId } from './id';
import {
  createStandardPersonWrapper,
  createEmptySavedPersonRecord,
  normalizeSavedPersonRecord
} from './family3Schema';

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
  return {
    id: createId('person'),
    fullName: '',
    nickname: '',
    photo: '',
    ...overrides
  };
}

export function createEmptyStandardPerson(overrides = {}) {
  return createStandardPersonWrapper(
    createEmptySavedPersonRecord(),
    {
      id: 'standard-person',
      hiddenFields: {},
      node: {
        title: '',
        coverImage: '',
        imageCaption: '',
        eventDate: '',
        location: '',
        notes: '',
        hideFromModule: false
      },
      ...overrides
    }
  );
}

export function createDefaultPeopleByType(nodeType = NODE_TYPES.STANDARD) {
  if (nodeType === NODE_TYPES.PERSONS) {
    return [createEmptyPerson()];
  }
  return [];
}

export function createDefaultHandles() {
  return {
    top: 1,
    right: 1,
    bottom: 1,
    left: 1
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
    hideNodeDetailsFromModule: false,
    tags: '',
    nodeWidth: 220,
    nodeHeight: 220,
    nodeRadius: 18,
    handles: createDefaultHandles(),
    handleLayout: createDefaultHandleLayout(),
    imageSettings: createDefaultImageSettings(),
    people: [],
    peopleNodeDisplaySingleImage: false,
    peopleNodeSingleImageUrl: '',
    peopleNodeSingleImageTitle: '',
    peopleModalShowDisplayImage: false,
    peopleModalDisplayImageUrl: '',
    peopleModalFamilyName: '',
    standardPerson: createEmptyStandardPerson()
  };
}

export function normalizePersonRecord(person = {}) {
  const base = createEmptyPerson({ id: person.id || createId('person') });
  const cleaned = { ...person };
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

function normalizeStandardPerson(person = {}) {
  return createStandardPersonWrapper(person, {
    id: person.id || 'standard-person',
    hiddenFields: person.hiddenFields,
    node: person.node || person.nodeMeta,
    nodeMeta: person.nodeMeta
  });
}

function clonePeople(people = []) {
  return people.map((person, index) => ({
    ...createEmptyPerson({ relationshipToPrimary: index === 0 ? 'primary' : 'other' }),
    ...person,
    id: person.id || createId('person')
  }));
}

function normalizePeople(nodeType, people) {
  const current = people?.length ? clonePeople(people) : createDefaultPeopleByType(nodeType);
  if (nodeType === NODE_TYPES.STANDARD) {
    return [];
  }
  return current;
}

function hasGroupedPeopleContent(people = []) {
  return Array.isArray(people) && people.some((person) => {
    if (!person || typeof person !== 'object') return false;
    return ['fullName', 'nickname', 'photo', 'birthDate'].some((field) => String(person[field] || '').trim().length > 0);
  });
}

function inferNodeType(data = {}, fallback = NODE_TYPES.STANDARD) {
  if ([NODE_TYPES.STANDARD, NODE_TYPES.PERSONS].includes(data.nodeType)) {
    return data.nodeType;
  }

  const hasPeopleEntries = hasGroupedPeopleContent(data.people);
  const hasSingleImageConfig = Boolean(data.peopleNodeDisplaySingleImage)
    || String(data.peopleNodeSingleImageUrl || '').trim().length > 0
    || String(data.peopleNodeSingleImageTitle || '').trim().length > 0
    || Boolean(data.peopleModalShowDisplayImage)
    || String(data.peopleModalDisplayImageUrl || '').trim().length > 0
    || String(data.peopleModalFamilyName || '').trim().length > 0;

  if (hasPeopleEntries || hasSingleImageConfig) {
    return NODE_TYPES.PERSONS;
  }

  return fallback;
}

export function normalizeNodeData(data = {}) {
  const defaults = createNodeData();
  const nodeType = inferNodeType(data, defaults.nodeType);

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
    peopleNodeDisplaySingleImage: Boolean(data.peopleNodeDisplaySingleImage),
    peopleNodeSingleImageUrl: typeof data.peopleNodeSingleImageUrl === 'string' ? data.peopleNodeSingleImageUrl : '',
    peopleNodeSingleImageTitle: typeof data.peopleNodeSingleImageTitle === 'string' ? data.peopleNodeSingleImageTitle : '',
    peopleModalShowDisplayImage: Boolean(data.peopleModalShowDisplayImage),
    peopleModalDisplayImageUrl: typeof data.peopleModalDisplayImageUrl === 'string' ? data.peopleModalDisplayImageUrl : '',
    peopleModalFamilyName: typeof data.peopleModalFamilyName === 'string' ? data.peopleModalFamilyName : '',
    hideNodeDetailsFromModule: Boolean(data.hideNodeDetailsFromModule || data.hideFromModule || data.standardPerson?.person?.node?.hideFromModule || data.standardPerson?.node?.hideFromModule),
    standardPerson: normalizeStandardPerson(data.standardPerson || {})
  };
}

export function createFamilyNode(position = { x: 250, y: 180 }, dataOverrides = {}) {
  const normalized = normalizeNodeData(dataOverrides);
  return {
    id: createId('node'),
    type: 'familyNode',
    position,
    data: normalized
  };
}

export function duplicateFamilyNode(node, offset = { x: 40, y: 40 }) {
  const clonedData = normalizeNodeData(node.data || {});
  clonedData.people = (clonedData.people || []).map((person) => ({ ...person, id: createId('person') }));
  clonedData.standardPerson = {
    ...clonedData.standardPerson,
    id: 'standard-person'
  };

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

export function normalizeSavedPersonForLibrary(record = {}) {
  return normalizeSavedPersonRecord(record);
}
