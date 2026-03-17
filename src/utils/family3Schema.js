export const RELATIONSHIP_OPTIONS = {
  parents: [
    'Biological parent',
    'Adoptive parent',
    'Step-parent',
    'Foster parent',
    'Guardian',
    'Other'
  ],
  children: [
    'Biological child',
    'Adopted child',
    'Stepchild',
    'Foster child',
    'Ward',
    'Other'
  ],
  siblings: [
    'Full sibling',
    'Half sibling',
    'Step-sibling',
    'Adoptive sibling',
    'Foster sibling',
    'Other'
  ],
  partners: [
    'Spouse',
    'Partner',
    'Fiancé / fiancée',
    'Former spouse',
    'Former partner',
    'Other'
  ]
};

export const NODE_DETAILS_FIELDS = {
  title: '',
  coverImage: '',
  imageCaption: '',
  eventDate: '',
  location: '',
  notes: ''
};

export const SUBMISSION_META_FIELDS = {
  submittedAt: '',
  status: 'pending'
};

export const FORM_PERSON_FIELD_ORDER = [
  'name',
  'birthDate',
  'photo',
  'nickname',
  'prefix',
  'maidenName',
  'gender',
  'birthPlace',
  'currentLocation',
  'heritage',
  'isAlive',
  'deathDate',
  'deathPlace',
  'occupation',
  'education',
  'maritalStatus',
  'languages',
  'biography',
  'achievements',
  'interests',
  'personality',
  'familyNotes'
];

export const FORM_PERSON_FIELD_META = {
  name: { label: 'Full name and surname', inputType: 'person-name', placeholder: 'Type a name or select an existing person' },
  birthDate: { label: 'Birth date', inputType: 'date' },
  photo: { label: 'Photo', inputType: 'text', placeholder: 'Paste an image URL' },
  nickname: { label: 'Nickname or preferred name', inputType: 'text' },
  prefix: { label: 'Title or prefix', inputType: 'text', placeholder: 'Mr, Mrs, Dr' },
  maidenName: { label: 'Birth surname', inputType: 'text' },
  gender: { label: 'Gender', inputType: 'select', options: ['Female', 'Male', 'Other', 'Prefer not to say'] },
  birthPlace: { label: 'Birth place', inputType: 'text', placeholder: 'Town, city, or country' },
  currentLocation: { label: 'Current town or city', inputType: 'text', placeholder: 'Where they live or are based' },
  heritage: { label: 'Nationality or heritage (for example South African, British, Xhosa, etc.)', inputType: 'text', placeholder: 'South African, British, Xhosa, etc.' },
  isAlive: { label: 'Still living?', inputType: 'select', options: ['Yes', 'No', 'Not sure'] },
  deathDate: { label: 'Death date', inputType: 'date' },
  deathPlace: { label: 'Death place', inputType: 'text' },
  occupation: { label: 'Occupation', inputType: 'text' },
  education: { label: 'Education or training', inputType: 'text', placeholder: 'School, degree, trade, or training' },
  maritalStatus: { label: 'Marital status', inputType: 'select', options: ['Single', 'Married', 'Divorced', 'Widowed', 'Separated', 'Partnered'] },
  languages: { label: 'Languages spoken', inputType: 'text', placeholder: 'Separate with commas' },
  biography: { label: 'About this person', inputType: 'textarea', rows: 4 },
  achievements: { label: 'Important life moments', inputType: 'textarea', rows: 3 },
  interests: { label: 'Interests and hobbies', inputType: 'textarea', rows: 3 },
  personality: { label: 'Personality and how people remember them', inputType: 'textarea', rows: 3 },
  familyNotes: { label: 'Additional family notes', inputType: 'textarea', rows: 4 }
};

export const FAMILY3_PERSON_FIELDS = {
  name: '',
  birthDate: '',
  photo: '',
  nickname: '',
  prefix: '',
  maidenName: '',
  gender: '',
  birthPlace: '',
  currentLocation: '',
  heritage: '',
  isAlive: '',
  deathDate: '',
  deathPlace: '',
  occupation: '',
  education: '',
  maritalStatus: '',
  languages: '',
  biography: '',
  achievements: '',
  interests: '',
  personality: '',
  familyNotes: '',
  submissionMeta: { ...SUBMISSION_META_FIELDS },
  relationships: {
    parents: [],
    children: [],
    siblings: [],
    partners: []
  },
  node: { ...NODE_DETAILS_FIELDS }
};

const LEGACY_PERSON_FIELDS_TO_STRIP = new Set([
  'contactNumber',
  'teams',
  'editedAncestry',
  'edited ancestry',
  'ancestryEdited'
]);

const INTERNAL_PERSON_KEYS = new Set(['submissionMeta', 'relationships', 'node']);

function cleanString(value) {
  return typeof value === 'string' ? value : (value == null ? '' : String(value));
}

function normalizeBool(value, fallback = '') {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function toTitleCaseLabel(key = '') {
  return cleanString(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

export function sanitizePersonFieldKey(key) {
  return cleanString(key).trim();
}

export function isStrippedPersonField(key) {
  return LEGACY_PERSON_FIELDS_TO_STRIP.has(sanitizePersonFieldKey(key));
}

export function getDynamicPersonFieldKeys(person = {}) {
  const source = person && typeof person === 'object' ? person : {};
  const objectKeys = Object.keys(source)
    .map((key) => sanitizePersonFieldKey(key))
    .filter((key) => key && !INTERNAL_PERSON_KEYS.has(key) && !isStrippedPersonField(key));

  const orderedKnown = FORM_PERSON_FIELD_ORDER.filter((key) => objectKeys.includes(key) || Object.prototype.hasOwnProperty.call(FAMILY3_PERSON_FIELDS, key));
  const unknownKeys = objectKeys
    .filter((key) => !orderedKnown.includes(key))
    .sort((a, b) => a.localeCompare(b));

  return [...orderedKnown, ...unknownKeys];
}

export function getPersonFieldMeta(fieldKey, value = '') {
  const key = sanitizePersonFieldKey(fieldKey);
  const known = FORM_PERSON_FIELD_META[key];
  if (known) {
    return { key, ...known };
  }

  const stringValue = cleanString(value);
  const looksLong = stringValue.length > 120 || /notes|bio|story|summary|description|details/i.test(key);
  return {
    key,
    label: toTitleCaseLabel(key),
    inputType: looksLong ? 'textarea' : 'text',
    rows: looksLong ? 4 : undefined,
    placeholder: ''
  };
}

function sanitizePersonExtras(source = {}) {
  return Object.fromEntries(
    Object.entries(source || {}).filter(([key]) => {
      const normalizedKey = sanitizePersonFieldKey(key);
      return normalizedKey && !INTERNAL_PERSON_KEYS.has(normalizedKey) && !isStrippedPersonField(normalizedKey);
    })
  );
}

export function createEmptyRelationshipEntry(overrides = {}) {
  return {
    type: '',
    name: '',
    birthDate: '',
    photo: '',
    ...overrides
  };
}

export function createEmptyFamily3Relationships(overrides = {}) {
  return {
    parents: [],
    children: [],
    siblings: [],
    partners: [],
    ...overrides
  };
}

export function createEmptyNodeDetails(overrides = {}) {
  return {
    ...NODE_DETAILS_FIELDS,
    ...overrides
  };
}

export function createEmptySubmissionMeta(overrides = {}) {
  return {
    ...SUBMISSION_META_FIELDS,
    ...overrides
  };
}

export function createEmptyFamily3Person(overrides = {}) {
  const {
    address: _legacyAddress,
    person: _nestedPerson,
    nodeMeta: _legacyNodeMeta,
    relationships: relationshipsOverride,
    node: nodeOverride,
    submissionMeta: submissionMetaOverride,
    ...rawSafeOverrides
  } = overrides || {};
  const safeOverrides = sanitizePersonExtras(rawSafeOverrides);
  const relationships = createEmptyFamily3Relationships(
    relationshipsOverride || overrides.person?.relationships || {}
  );
  const node = createEmptyNodeDetails(
    nodeOverride || overrides.person?.node || overrides.nodeMeta || {}
  );
  const submissionMeta = createEmptySubmissionMeta(
    submissionMetaOverride || overrides.person?.submissionMeta || {}
  );

  return {
    ...FAMILY3_PERSON_FIELDS,
    ...safeOverrides,
    currentLocation: cleanString(overrides.currentLocation || overrides.address),
    isAlive: Object.prototype.hasOwnProperty.call(overrides, 'isAlive')
      ? normalizeBool(overrides.isAlive, '')
      : FAMILY3_PERSON_FIELDS.isAlive,
    submissionMeta,
    relationships,
    node
  };
}

export function createEmptySavedPersonRecord(overrides = {}) {
  const record = {
    firebaseDocumentId: '',
    person: createEmptyFamily3Person(overrides.person || {}),
    ...overrides
  };

  return {
    firebaseDocumentId: cleanString(record.firebaseDocumentId || record.documentId),
    person: createEmptyFamily3Person(record.person || {})
  };
}

function buildDefaultNodeTitle(person = {}) {
  return cleanString(person?.name || '').trim();
}

function buildDefaultNodeCover(person = {}) {
  return cleanString(person?.photo || '').trim();
}

function normalizeNodeDetails(node = {}, person = {}) {
  const normalizedPerson = createEmptyFamily3Person(person);
  const title = cleanString(node?.title).trim() || buildDefaultNodeTitle(normalizedPerson);
  const coverImage = cleanString(node?.coverImage || node?.thumbnailPhoto || node?.photo).trim() || buildDefaultNodeCover(normalizedPerson);

  return createEmptyNodeDetails({
    title,
    coverImage,
    imageCaption: cleanString(node?.imageCaption || node?.photoCaption),
    eventDate: cleanString(node?.eventDate),
    location: cleanString(node?.location),
    notes: cleanString(node?.notes)
  });
}

export function syncNodeDetailsWithPerson(node = {}, person = {}, { force = false } = {}) {
  const normalizedPerson = createEmptyFamily3Person(person);
  const normalizedNode = normalizeNodeDetails(node, normalizedPerson);

  return createEmptyNodeDetails({
    ...normalizedNode,
    title: force || !cleanString(node?.title).trim() ? buildDefaultNodeTitle(normalizedPerson) : normalizedNode.title,
    coverImage: force || !cleanString(node?.coverImage || node?.thumbnailPhoto || node?.photo).trim()
      ? buildDefaultNodeCover(normalizedPerson)
      : normalizedNode.coverImage
  });
}

export function getRecordRelationships(record = {}) {
  return createEmptyFamily3Relationships(
    record?.person?.relationships || record?.relationships || {}
  );
}

export function getRecordNode(record = {}) {
  return createEmptyNodeDetails(
    record?.person?.node || record?.node || record?.nodeMeta || {}
  );
}

export function getRecordSubmissionMeta(record = {}) {
  return createEmptySubmissionMeta(
    record?.person?.submissionMeta || record?.submissionMeta || {}
  );
}

export function getRecordName(record) {
  return cleanString(record?.person?.name || record?.fullName || record?.name || '');
}

export function getRecordPhoto(record) {
  return cleanString(record?.person?.photo || record?.photo || '');
}

export function getRecordNickname(record) {
  return cleanString(record?.person?.nickname || record?.nickname || '');
}

export function getRecordBirthDate(record) {
  return cleanString(record?.person?.birthDate || record?.birthDate || '');
}

export function getRecordCurrentLocation(record) {
  return cleanString(record?.person?.currentLocation || record?.person?.address || record?.currentLocation || record?.address || '');
}

export function getRecordNodeTitle(record) {
  return cleanString(getRecordNode(record)?.title || record?.title || getRecordName(record));
}

export function getRecordNodeCoverImage(record) {
  return cleanString(getRecordNode(record)?.coverImage || record?.photo || getRecordPhoto(record));
}

export function isFamily3Record(record) {
  return !!(record && typeof record === 'object' && record.person && (record.person?.relationships || record.relationships || record.person?.node || record.node));
}



function slugifyIdentifierPart(value = '') {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function createPersonIdentifierBase(record = {}) {
  const normalizedName = slugifyIdentifierPart(getRecordName(record));
  return normalizedName || 'person';
}

export function generateUniqueSavedPersonId(record = {}, usedIds = new Set()) {
  const base = createPersonIdentifierBase(record);
  let candidate = `person_${base}`;
  let counter = 2;

  while (usedIds.has(candidate)) {
    candidate = `person_${base}_${counter}`;
    counter += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

export function backfillSavedPeopleDocumentIds(list = []) {
  const normalizedList = normalizeSavedPeopleCollection(list || []);
  const usedIds = new Set(
    normalizedList
      .map((item) => cleanString(item?.firebaseDocumentId || ''))
      .filter(Boolean)
  );

  let changedCount = 0;
  const nextList = normalizedList.map((item) => {
    const existingId = cleanString(item?.firebaseDocumentId || '');
    if (existingId) {
      return item;
    }

    changedCount += 1;
    return createEmptySavedPersonRecord({
      ...item,
      firebaseDocumentId: generateUniqueSavedPersonId(item, usedIds),
      person: item.person
    });
  });

  return {
    savedPeople: nextList,
    changedCount
  };
}

export function findSavedPersonByName(savedPeople = [], value = '') {
  const target = cleanString(value).trim().replace(/\s+/g, ' ').toLowerCase();
  if (!target) return null;
  return normalizeSavedPeopleCollection(savedPeople).find((item) => cleanString(getRecordName(item)).trim().replace(/\s+/g, ' ').toLowerCase() === target) || null;
}

export function personRecordToLinkedDraft(record = {}, overrides = {}) {
  const normalized = normalizeSavedPersonRecord(record);
  const person = normalized.person || createEmptyFamily3Person();
  const draft = {
    fullName: cleanString(person.name || ''),
    nickname: cleanString(person.nickname || ''),
    birthDate: cleanString(person.birthDate || ''),
    photo: cleanString(person.photo || ''),
    prefix: cleanString(person.prefix || ''),
    maidenName: cleanString(person.maidenName || ''),
    gender: cleanString(person.gender || ''),
    birthPlace: cleanString(person.birthPlace || ''),
    currentLocation: cleanString(person.currentLocation || ''),
    heritage: cleanString(person.heritage || ''),
    isAlive: Object.prototype.hasOwnProperty.call(person, 'isAlive') ? person.isAlive : '',
    deathDate: cleanString(person.deathDate || ''),
    deathPlace: cleanString(person.deathPlace || ''),
    occupation: cleanString(person.occupation || ''),
    education: cleanString(person.education || ''),
    maritalStatus: cleanString(person.maritalStatus || ''),
    languages: cleanString(person.languages || ''),
    biography: cleanString(person.biography || ''),
    achievements: cleanString(person.achievements || ''),
    interests: cleanString(person.interests || ''),
    personality: cleanString(person.personality || ''),
    familyNotes: cleanString(person.familyNotes || ''),
    submissionMeta: person.submissionMeta,
    relationships: person.relationships,
    node: person.node
  };

  return {
    ...draft,
    ...overrides,
    fullName: cleanString(overrides?.fullName || overrides?.name || draft.fullName),
    nickname: cleanString(overrides?.nickname ?? draft.nickname),
    birthDate: cleanString(overrides?.birthDate ?? draft.birthDate),
    photo: cleanString(overrides?.photo ?? draft.photo)
  };
}

export function linkedPersonDraftToSavedRecord(entry = {}) {
  const name = cleanString(entry?.fullName || entry?.name || '').trim();
  const photo = cleanString(entry?.photo || '').trim();
  return createEmptySavedPersonRecord({
    firebaseDocumentId: cleanString(entry?.firebaseDocumentId || entry?.documentId),
    person: createEmptyFamily3Person({
      ...sanitizePersonExtras(entry || {}),
      name,
      photo,
      submissionMeta: normalizeSubmissionMeta(entry?.submissionMeta || {}),
      relationships: createEmptyFamily3Relationships(entry?.relationships || {}),
      node: syncNodeDetailsWithPerson(entry?.node || { title: name, coverImage: photo }, {
        ...sanitizePersonExtras(entry || {}),
        name,
        photo
      })
    })
  });
}

function normalizeRelationshipEntry(entry, fallbackType = '') {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const name = cleanString(entry).trim();
    return name ? createEmptyRelationshipEntry({ type: fallbackType, name }) : null;
  }

  const name = cleanString(entry.name || entry.fullName || '').trim();
  if (!name) return null;

  return createEmptyRelationshipEntry({
    type: cleanString(entry.type || fallbackType),
    name,
    birthDate: cleanString(entry.birthDate || ''),
    photo: cleanString(entry.photo || '')
  });
}

function normalizeRelationshipList(list, fallbackType = '') {
  return (Array.isArray(list) ? list : [])
    .map((item) => normalizeRelationshipEntry(item, fallbackType))
    .filter(Boolean);
}

function mergeRelationshipLists(...lists) {
  const seen = new Map();
  lists.flat().forEach((entry) => {
    const normalized = normalizeRelationshipEntry(entry);
    if (!normalized) return;
    const key = normalized.name.trim().toLowerCase();
    if (!key) return;
    const prev = seen.get(key) || createEmptyRelationshipEntry();
    seen.set(key, {
      ...prev,
      ...normalized,
      type: normalized.type || prev.type || ''
    });
  });
  return [...seen.values()];
}

function legacySingleToList(entry, type) {
  const normalized = normalizeRelationshipEntry(entry, type);
  return normalized ? [normalized] : [];
}

function normalizeSubmissionMeta(raw = {}) {
  return createEmptySubmissionMeta({
    submittedAt: cleanString(raw?.submittedAt),
    status: cleanString(raw?.status) || SUBMISSION_META_FIELDS.status
  });
}

export function normalizeSavedPersonRecord(record = {}) {
  if (isFamily3Record(record)) {
    const currentPerson = record.person || {};
    const currentRelationships = currentPerson.relationships || record.relationships || {};
    const currentNode = currentPerson.node || record.node || record.nodeMeta || {};
    const currentSubmissionMeta = currentPerson.submissionMeta || record.submissionMeta || {};
    const { relationships: _personRelationships, node: _personNode, submissionMeta: _personSubmissionMeta, ...rawPersonFields } = currentPerson;
    const personFields = sanitizePersonExtras(rawPersonFields);
    const inferredAlive = personFields.isAlive ?? (personFields.deathDate ? false : '');
    const normalizedPerson = createEmptyFamily3Person({
      ...personFields,
      name: getRecordName(record).trim(),
      birthDate: cleanString(personFields.birthDate),
      photo: getRecordPhoto(record),
      nickname: getRecordNickname(record),
      currentLocation: cleanString(personFields.currentLocation || personFields.address),
      isAlive: normalizeBool(inferredAlive, ''),
      deathDate: cleanString(personFields.deathDate),
      deathPlace: cleanString(personFields.deathPlace),
      submissionMeta: normalizeSubmissionMeta(currentSubmissionMeta),
      relationships: createEmptyFamily3Relationships({
        parents: normalizeRelationshipList(currentRelationships?.parents),
        children: normalizeRelationshipList(currentRelationships?.children),
        siblings: normalizeRelationshipList(currentRelationships?.siblings),
        partners: normalizeRelationshipList(currentRelationships?.partners)
      }),
      node: syncNodeDetailsWithPerson(currentNode, personFields)
    });

    return createEmptySavedPersonRecord({
      firebaseDocumentId: cleanString(record.firebaseDocumentId || record.documentId),
      person: normalizedPerson
    });
  }

  const aliveFallback = record.stillAlive ?? record.isAlive ?? (!record.deathDate && !record.deathPlace ? '' : false);

  const parentEntries = mergeRelationshipLists(
    legacySingleToList(record.father, 'Biological parent'),
    legacySingleToList(record.mother, 'Biological parent'),
    normalizeRelationshipList(record.parents, 'Biological parent'),
    normalizeRelationshipList(record.stepFathers, 'Step-parent'),
    normalizeRelationshipList(record.stepMothers, 'Step-parent'),
    normalizeRelationshipList(record.fosterParents, 'Foster parent'),
    normalizeRelationshipList(record.fosterFathers, 'Foster parent'),
    normalizeRelationshipList(record.fosterMothers, 'Foster parent'),
    normalizeRelationshipList(record.adoptiveParents, 'Adoptive parent'),
    normalizeRelationshipList(record.adoptiveFathers, 'Adoptive parent'),
    normalizeRelationshipList(record.adoptiveMothers, 'Adoptive parent')
  );

  const childEntries = mergeRelationshipLists(
    normalizeRelationshipList(record.children, 'Biological child'),
    normalizeRelationshipList(record.fosterChildren, 'Foster child'),
    normalizeRelationshipList(record.adoptedChildren, 'Adopted child')
  );

  const siblingEntries = mergeRelationshipLists(
    normalizeRelationshipList(record.siblings, 'Full sibling')
  );

  const partnerEntries = mergeRelationshipLists(
    normalizeRelationshipList(record.girlfriends, 'Partner'),
    normalizeRelationshipList(record.boyfriends, 'Partner'),
    normalizeRelationshipList(record.husbands, 'Spouse'),
    normalizeRelationshipList(record.wives, 'Spouse'),
    normalizeRelationshipList(record.partners, 'Partner')
  );

  const normalizedPerson = createEmptyFamily3Person({
    name: getRecordName(record).trim(),
    birthDate: cleanString(record.birthDate),
    photo: getRecordPhoto(record),
    nickname: getRecordNickname(record),
    prefix: cleanString(record.prefix),
    maidenName: cleanString(record.maidenName),
    gender: cleanString(record.gender),
    birthPlace: cleanString(record.birthPlace),
    currentLocation: cleanString(record.currentLocation || record.address || record.residence),
    heritage: cleanString(record.heritage),
    isAlive: normalizeBool(aliveFallback, ''),
    deathDate: cleanString(record.deathDate),
    deathPlace: cleanString(record.deathPlace || record.burialPlace),
    occupation: cleanString(record.occupation),
    education: cleanString(record.education),
    maritalStatus: cleanString(record.maritalStatus),
    languages: cleanString(record.languages),
    biography: cleanString(record.biography || record.moreInfo),
    achievements: cleanString(record.achievements),
    interests: cleanString(record.interests),
    personality: cleanString(record.personality),
    familyNotes: cleanString(record.familyNotes),
    submissionMeta: normalizeSubmissionMeta(record.submissionMeta),
    relationships: createEmptyFamily3Relationships({
      parents: parentEntries,
      children: childEntries,
      siblings: siblingEntries,
      partners: partnerEntries
    }),
    node: syncNodeDetailsWithPerson(record.node || record.nodeMeta || {
      title: record.title,
      coverImage: record.photo,
      imageCaption: record.photoCaption,
      eventDate: record.eventDate,
      location: record.location,
      notes: record.notes
    }, {
      name: getRecordName(record).trim(),
      photo: getRecordPhoto(record)
    })
  });

  return createEmptySavedPersonRecord({
    firebaseDocumentId: cleanString(record.firebaseDocumentId || record.documentId),
    person: normalizedPerson
  });
}

export function normalizeSavedPeopleCollection(list = []) {
  return (Array.isArray(list) ? list : [])
    .map((item) => normalizeSavedPersonRecord(item))
    .filter((item) => getRecordName(item).trim().length > 0);
}

export function createStandardPersonWrapper(record = {}, extras = {}) {
  const normalized = normalizeSavedPersonRecord(record);
  const personBase = normalized.person || createEmptyFamily3Person();
  const node = syncNodeDetailsWithPerson(
    extras.node || extras.nodeMeta || record.node || record.person?.node || record.nodeMeta || personBase.node,
    personBase
  );
  const relationships = createEmptyFamily3Relationships(
    extras.relationships || record.relationships || record.person?.relationships || personBase.relationships
  );
  const submissionMeta = normalizeSubmissionMeta(
    extras.submissionMeta || record.submissionMeta || record.person?.submissionMeta || personBase.submissionMeta
  );
  const person = createEmptyFamily3Person({
    ...personBase,
    relationships,
    node,
    submissionMeta
  });

  return {
    id: extras.id || record.id || 'standard-person',
    firebaseDocumentId: cleanString(extras.firebaseDocumentId || record.firebaseDocumentId || record.documentId || normalized.firebaseDocumentId),
    person,
    relationships: person.relationships,
    node: person.node,
    submissionMeta: person.submissionMeta,
    hiddenFields: typeof extras.hiddenFields === 'object' && extras.hiddenFields
      ? extras.hiddenFields
      : (typeof record.hiddenFields === 'object' && record.hiddenFields ? record.hiddenFields : {}),
    nodeMeta: {
      title: person.node.title,
      thumbnailPhoto: person.node.coverImage,
      photoCaption: person.node.imageCaption,
      eventDate: person.node.eventDate,
      location: person.node.location,
      notes: person.node.notes
    }
  };
}

export function standardPersonToSavedRecord(standardPerson = {}) {
  const normalized = createStandardPersonWrapper(standardPerson);
  return createEmptySavedPersonRecord({
    firebaseDocumentId: normalized.firebaseDocumentId || '',
    person: normalized.person
  });
}

export function savedPersonToFirebasePayload(record = {}) {
  const normalized = normalizeSavedPersonRecord(record);
  return {
    person: normalized.person
  };
}

export function getRecordSearchText(record = {}) {
  return [getRecordName(record), getRecordNickname(record), getRecordBirthDate(record)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
