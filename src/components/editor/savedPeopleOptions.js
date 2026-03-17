import { findSavedPersonByName, getRecordName, getRecordNickname, normalizeSavedPersonRecord } from '../../utils/family3Schema';

function normalizeOptionLabel(label) {
  return String(label || '').trim().replace(/\s+/g, ' ');
}

export function buildSavedPeopleOptions(savedPeople = []) {
  const seen = new Set();

  return (savedPeople || [])
    .map((item) => normalizeSavedPersonRecord(item))
    .filter((item) => getRecordName(item).trim().length > 0)
    .sort((a, b) => getRecordName(a).localeCompare(getRecordName(b), undefined, { sensitivity: 'base' }))
    .map((item) => {
      const label = normalizeOptionLabel(getRecordName(item));
      const key = label.toLowerCase();
      if (!label || seen.has(key)) return null;
      seen.add(key);
      return {
        label,
        value: label,
        person: item,
        searchTerms: [label, getRecordNickname(item)].filter(Boolean).join(' ').trim()
      };
    })
    .filter(Boolean);
}


export function resolveSavedPersonSelection(savedPeopleOptions = [], savedPeople = [], value = '', item = null) {
  if (item?.person) return item.person;

  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) return null;

  const optionMatch = (savedPeopleOptions || []).find((option) => option?.value === normalizedValue || option?.label === normalizedValue);
  if (optionMatch?.person) return optionMatch.person;

  return findSavedPersonByName(savedPeople, normalizedValue);
}
