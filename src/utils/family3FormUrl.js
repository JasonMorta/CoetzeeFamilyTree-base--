import { FAMILY_SLUG } from '../config/familyConfig';

const DEFAULT_FAMILY3_FORM_BASE_URL = 'https://family3form.mortadev.com/';
const family3FormBaseUrl = String(import.meta.env.VITE_FAMILY3_FORM_BASE_URL || DEFAULT_FAMILY3_FORM_BASE_URL).trim() || DEFAULT_FAMILY3_FORM_BASE_URL;

export function buildFamily3BaseLink() {
  try {
    const url = new URL(family3FormBaseUrl);
    url.searchParams.set('family', FAMILY_SLUG);
    return url.toString();
  } catch (error) {
    const separator = family3FormBaseUrl.includes('?') ? '&' : '?';
    return `${family3FormBaseUrl}${separator}family=${encodeURIComponent(FAMILY_SLUG)}`;
  }
}

export function buildFamily3EditLink(personExternalId) {
  const recordId = String(personExternalId || '').trim();
  if (!recordId) return '';

  try {
    const url = new URL(family3FormBaseUrl);
    url.searchParams.set('family', FAMILY_SLUG);
    url.searchParams.set('editPersonId', recordId);
    return url.toString();
  } catch (error) {
    const separator = family3FormBaseUrl.includes('?') ? '&' : '?';
    return `${family3FormBaseUrl}${separator}family=${encodeURIComponent(FAMILY_SLUG)}&editPersonId=${encodeURIComponent(recordId)}`;
  }
}
