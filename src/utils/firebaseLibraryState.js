import { createStandardPersonWrapper, getRecordName, normalizeSavedPeopleCollection, standardPersonToSavedRecord, syncNodeDetailsWithPerson } from './family3Schema';


function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function upsertSavedPersonRecord(library = [], record) {
  const normalizedLibrary = normalizeSavedPeopleCollection(library || []);
  const normalizedRecord = standardPersonToSavedRecord(createStandardPersonWrapper(record));
  const recordId = String(normalizedRecord.firebaseDocumentId || '').trim();
  const recordName = normalizeName(getRecordName(normalizedRecord));

  if (!recordName && !recordId) {
    return normalizedLibrary;
  }

  const next = [...normalizedLibrary];
  const index = next.findIndex((item) => {
    const itemId = String(item.firebaseDocumentId || '').trim();
    if (recordId && itemId) {
      return itemId === recordId;
    }
    return normalizeName(getRecordName(item)) === recordName;
  });

  if (index >= 0) {
    next[index] = normalizedRecord;
  } else {
    next.push(normalizedRecord);
  }

  return next;
}

export function removeSavedPersonRecord(library = [], documentId = '', fallbackName = '') {
  const normalizedLibrary = normalizeSavedPeopleCollection(library || []);
  const targetId = String(documentId || '').trim();
  const targetName = normalizeName(fallbackName);

  return normalizedLibrary.filter((item) => {
    const itemId = String(item.firebaseDocumentId || '').trim();
    if (targetId && itemId) {
      return itemId !== targetId;
    }
    return normalizeName(getRecordName(item)) !== targetName;
  });
}

export function applySavedPersonRecordToNodes(nodes = [], record) {
  const normalizedRecord = createStandardPersonWrapper(record);
  const recordId = String(normalizedRecord.firebaseDocumentId || '').trim();
  const recordName = normalizeName(normalizedRecord.person?.name || '');

  return (Array.isArray(nodes) ? nodes : []).map((node) => {
    const current = createStandardPersonWrapper(node?.data?.standardPerson || {});
    const currentId = String(current.firebaseDocumentId || '').trim();
    const currentName = normalizeName(current.person?.name || '');
    const matches = (recordId && currentId && recordId === currentId) || (!recordId && recordName && currentName === recordName);

    if (!matches) {
      return node;
    }

    const nextStandard = createStandardPersonWrapper({
      ...normalizedRecord,
      id: current.id || normalizedRecord.id || 'standard-person'
    });
    const syncedNode = syncNodeDetailsWithPerson(nextStandard.node, nextStandard.person);
    const nextPayload = createStandardPersonWrapper({
      ...nextStandard,
      node: syncedNode
    });

    return {
      ...node,
      data: {
        ...(node.data || {}),
        title: syncedNode.title,
        photo: syncedNode.coverImage,
        photoCaption: syncedNode.imageCaption,
        eventDate: syncedNode.eventDate,
        location: syncedNode.location,
        notes: syncedNode.notes,
        standardPerson: nextPayload
      }
    };
  });
}


export function applySavedPeopleRecordIdsToNodes(nodes = [], savedPeople = []) {
  const normalizedLibrary = normalizeSavedPeopleCollection(savedPeople || []);
  const idByName = new Map(
    normalizedLibrary
      .map((item) => [normalizeName(getRecordName(item)), String(item.firebaseDocumentId || '').trim()])
      .filter(([name, id]) => name && id)
  );

  return (Array.isArray(nodes) ? nodes : []).map((node) => {
    const current = createStandardPersonWrapper(node?.data?.standardPerson || {});
    if (String(current.firebaseDocumentId || '').trim()) {
      return node;
    }

    const matchId = idByName.get(normalizeName(current.person?.name || ''));
    if (!matchId) {
      return node;
    }

    const nextStandard = createStandardPersonWrapper({
      ...current,
      firebaseDocumentId: matchId
    });
    const syncedNode = syncNodeDetailsWithPerson(nextStandard.node, nextStandard.person);
    const nextPayload = createStandardPersonWrapper({
      ...nextStandard,
      node: syncedNode
    });

    return {
      ...node,
      data: {
        ...(node.data || {}),
        title: syncedNode.title,
        photo: syncedNode.coverImage,
        photoCaption: syncedNode.imageCaption,
        eventDate: syncedNode.eventDate,
        location: syncedNode.location,
        notes: syncedNode.notes,
        standardPerson: nextPayload
      }
    };
  });
}
