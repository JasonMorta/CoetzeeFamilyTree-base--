import { FAMILY_SLUG } from '../config/familyConfig';

const DEFAULT_FAMILY3_FORM_BASE_URL = 'https://family3form.mortadev.com/';

export const FAMILY3_FORM_BASE_URL = String(import.meta.env.VITE_FAMILY3_FORM_BASE_URL || DEFAULT_FAMILY3_FORM_BASE_URL).trim() || DEFAULT_FAMILY3_FORM_BASE_URL;

function resolveUrl(baseUrl) {
  const rawBase = String(baseUrl || FAMILY3_FORM_BASE_URL).trim() || DEFAULT_FAMILY3_FORM_BASE_URL;

  try {
    return new URL(rawBase, window.location.origin);
  } catch (error) {
    return new URL(DEFAULT_FAMILY3_FORM_BASE_URL);
  }
}

export function buildFamily3FormUrl({ family = FAMILY_SLUG, editPersonId = '' } = {}) {
  const url = resolveUrl(FAMILY3_FORM_BASE_URL);
  url.searchParams.set('family', String(family || FAMILY_SLUG).trim() || FAMILY_SLUG);

  const recordId = String(editPersonId || '').trim();
  if (recordId) {
    url.searchParams.set('editPersonId', recordId);
  } else {
    url.searchParams.delete('editPersonId');
  }

  return url.toString();
}
