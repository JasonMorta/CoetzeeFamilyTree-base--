import { DEFAULT_ADMIN, hasConfiguredAdminCredentials } from '../constants/auth';
import { STORAGE_KEYS } from '../constants/defaults';

export function loginAdmin(username, password) {
  if (!hasConfiguredAdminCredentials()) {
    console.error('Missing VITE_ADMIN_USERNAME or VITE_ADMIN_PASSWORD environment variables.');
    return false;
  }

  const isValid = username === DEFAULT_ADMIN.username && password === DEFAULT_ADMIN.password;

  if (isValid) {
    window.localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify({ isAdminAuthenticated: true }));
  }

  return isValid;
}

export function logoutAdmin() {
  window.localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify({ isAdminAuthenticated: false }));
}

export function loadAuthState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.AUTH);
    return raw ? JSON.parse(raw) : { isAdminAuthenticated: false };
  } catch (error) {
    console.error('Failed to load auth state:', error);
    return { isAdminAuthenticated: false };
  }
}
