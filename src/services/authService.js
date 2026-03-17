import {
  ADMIN_IDLE_TIMEOUT_MS,
  ADMIN_LOCKOUT_MS,
  ADMIN_MAX_LOGIN_ATTEMPTS,
  ADMIN_SESSION_DURATION_MS,
  AUTH_VERSION,
  DEFAULT_ADMIN,
  hasConfiguredAdminCredentials
} from '../constants/auth';
import { STORAGE_KEYS } from '../constants/defaults';

const DEFAULT_AUTH_STATE = {
  isAdminAuthenticated: false,
  authVersion: AUTH_VERSION,
  authenticatedAt: null,
  lastActivityAt: null,
  expiresAt: null,
  failedLoginAttempts: 0,
  lockoutUntil: null
};

function now() {
  return Date.now();
}

function persistAuthState(nextState) {
  window.localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(nextState));
  return nextState;
}

function createLoggedInState(timestamp = now(), previousState = DEFAULT_AUTH_STATE) {
  const expiresAt = Math.min(timestamp + ADMIN_SESSION_DURATION_MS, timestamp + ADMIN_IDLE_TIMEOUT_MS);
  return {
    ...DEFAULT_AUTH_STATE,
    ...previousState,
    isAdminAuthenticated: true,
    authVersion: AUTH_VERSION,
    authenticatedAt: timestamp,
    lastActivityAt: timestamp,
    expiresAt,
    failedLoginAttempts: 0,
    lockoutUntil: null
  };
}

function createLoggedOutState(previousState = DEFAULT_AUTH_STATE) {
  return {
    ...DEFAULT_AUTH_STATE,
    failedLoginAttempts: previousState.failedLoginAttempts || 0,
    lockoutUntil: previousState.lockoutUntil || null
  };
}

function normalizeAuthState(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_AUTH_STATE };
  }

  return {
    ...DEFAULT_AUTH_STATE,
    ...raw,
    authVersion: AUTH_VERSION,
    failedLoginAttempts: Math.max(0, Number(raw.failedLoginAttempts) || 0),
    lockoutUntil: raw.lockoutUntil ? Number(raw.lockoutUntil) || null : null,
    authenticatedAt: raw.authenticatedAt ? Number(raw.authenticatedAt) || null : null,
    lastActivityAt: raw.lastActivityAt ? Number(raw.lastActivityAt) || null : null,
    expiresAt: raw.expiresAt ? Number(raw.expiresAt) || null : null,
    isAdminAuthenticated: Boolean(raw.isAdminAuthenticated)
  };
}

export function getAdminLockoutStatus(authState = loadAuthState()) {
  const state = normalizeAuthState(authState);
  const currentTime = now();
  const isLocked = Boolean(state.lockoutUntil && currentTime < state.lockoutUntil);
  return {
    isLocked,
    lockoutUntil: isLocked ? state.lockoutUntil : null,
    remainingMs: isLocked ? state.lockoutUntil - currentTime : 0,
    failedLoginAttempts: state.failedLoginAttempts || 0,
    remainingAttempts: Math.max(0, ADMIN_MAX_LOGIN_ATTEMPTS - (state.failedLoginAttempts || 0))
  };
}

export function loadAuthState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.AUTH);
    const parsed = normalizeAuthState(raw ? JSON.parse(raw) : DEFAULT_AUTH_STATE);

    if (!parsed.isAdminAuthenticated) {
      return parsed;
    }

    const currentTime = now();
    const hasExpired = !parsed.expiresAt || currentTime >= parsed.expiresAt;
    if (hasExpired) {
      const loggedOut = createLoggedOutState(parsed);
      persistAuthState(loggedOut);
      return loggedOut;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to load auth state:', error);
    return { ...DEFAULT_AUTH_STATE };
  }
}

export function isAdminSessionValid(authState = loadAuthState()) {
  const state = normalizeAuthState(authState);
  return Boolean(state.isAdminAuthenticated && state.expiresAt && now() < state.expiresAt);
}

export function touchAdminSession(authState = loadAuthState()) {
  const state = normalizeAuthState(authState);
  if (!isAdminSessionValid(state)) {
    const loggedOut = createLoggedOutState(state);
    persistAuthState(loggedOut);
    return loggedOut;
  }

  const currentTime = now();
  const authenticatedAt = state.authenticatedAt || currentTime;
  const absoluteExpiry = authenticatedAt + ADMIN_SESSION_DURATION_MS;
  const idleExpiry = currentTime + ADMIN_IDLE_TIMEOUT_MS;
  const nextState = {
    ...state,
    lastActivityAt: currentTime,
    expiresAt: Math.min(absoluteExpiry, idleExpiry)
  };

  persistAuthState(nextState);
  return nextState;
}

export function requireAdminSession(authState = loadAuthState()) {
  if (!isAdminSessionValid(authState)) {
    throw new Error('Admin session required. Log in again to continue.');
  }

  return touchAdminSession(authState);
}

export function loginAdmin(username, password) {
  const currentState = loadAuthState();

  if (!hasConfiguredAdminCredentials()) {
    console.error('Missing VITE_ADMIN_USERNAME or VITE_ADMIN_PASSWORD environment variables.');
    return { ok: false, error: 'Admin login is not configured.' };
  }

  const lockout = getAdminLockoutStatus(currentState);
  if (lockout.isLocked) {
    return {
      ok: false,
      error: 'Too many failed login attempts. Try again later.',
      lockoutUntil: lockout.lockoutUntil,
      remainingMs: lockout.remainingMs
    };
  }

  const isValid = username === DEFAULT_ADMIN.username && password === DEFAULT_ADMIN.password;

  if (isValid) {
    const nextState = createLoggedInState(now(), currentState);
    persistAuthState(nextState);
    return { ok: true, authState: nextState };
  }

  const nextFailedAttempts = (currentState.failedLoginAttempts || 0) + 1;
  const shouldLock = nextFailedAttempts >= ADMIN_MAX_LOGIN_ATTEMPTS;
  const nextState = {
    ...createLoggedOutState(currentState),
    failedLoginAttempts: nextFailedAttempts,
    lockoutUntil: shouldLock ? now() + ADMIN_LOCKOUT_MS : null
  };
  persistAuthState(nextState);

  return {
    ok: false,
    error: shouldLock ? 'Too many failed login attempts. Try again later.' : 'Invalid admin credentials.',
    remainingAttempts: Math.max(0, ADMIN_MAX_LOGIN_ATTEMPTS - nextFailedAttempts),
    lockoutUntil: nextState.lockoutUntil,
    remainingMs: nextState.lockoutUntil ? nextState.lockoutUntil - now() : 0
  };
}

export function logoutAdmin() {
  persistAuthState(createLoggedOutState(loadAuthState()));
}
