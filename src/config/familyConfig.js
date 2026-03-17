const DEFAULT_FAMILY_DISPLAY_NAME = 'Coetzee';
const DEFAULT_FAMILY_SLUG = 'coetzee';

function sanitizeFamilySlug(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) {
    return DEFAULT_FAMILY_SLUG;
  }

  const normalized = raw
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || DEFAULT_FAMILY_SLUG;
}

function sanitizeDisplayName(value) {
  const raw = String(value || '').trim();
  return raw || DEFAULT_FAMILY_DISPLAY_NAME;
}

export const FAMILY_DISPLAY_NAME = sanitizeDisplayName(import.meta.env.VITE_FAMILY_DISPLAY_NAME);
export const FAMILY_SLUG = sanitizeFamilySlug(import.meta.env.VITE_FAMILY_SLUG || FAMILY_DISPLAY_NAME);

export function buildFamilyScopedCollectionName(baseName, slug = FAMILY_SLUG) {
  const safeBase = String(baseName || '').trim();
  const safeSlug = sanitizeFamilySlug(slug);
  return safeBase && safeSlug ? `${safeBase}_${safeSlug}` : safeBase;
}

export function getFamilyAppTitle() {
  return `${FAMILY_DISPLAY_NAME} Family Tree`;
}

export function getFamilyConfig() {
  return {
    displayName: FAMILY_DISPLAY_NAME,
    slug: FAMILY_SLUG,
    appTitle: getFamilyAppTitle()
  };
}
