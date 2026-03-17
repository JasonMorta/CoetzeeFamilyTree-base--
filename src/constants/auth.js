const adminUsername = import.meta.env.VITE_ADMIN_USERNAME;
const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const DEFAULT_ADMIN = {
  username: adminUsername || '',
  password: adminPassword || ''
};

export const AUTH_VERSION = 2;
export const ADMIN_SESSION_DURATION_MS = parseNumber(import.meta.env.VITE_ADMIN_SESSION_DURATION_MS, 30 * 60 * 1000);
export const ADMIN_IDLE_TIMEOUT_MS = parseNumber(import.meta.env.VITE_ADMIN_IDLE_TIMEOUT_MS, 15 * 60 * 1000);
export const ADMIN_MAX_LOGIN_ATTEMPTS = parseNumber(import.meta.env.VITE_ADMIN_MAX_LOGIN_ATTEMPTS, 5);
export const ADMIN_LOCKOUT_MS = parseNumber(import.meta.env.VITE_ADMIN_LOCKOUT_MS, 10 * 60 * 1000);

export function hasConfiguredAdminCredentials() {
  return Boolean(adminUsername && adminPassword);
}
