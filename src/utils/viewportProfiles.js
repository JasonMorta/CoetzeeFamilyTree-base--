import { DEFAULT_VIEWPORT } from '../constants/defaults';

export const VIEWPORT_PROFILES = {
  MOBILE: 'mobile',
  DESKTOP: 'desktop'
};

export function getCurrentViewportProfile() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return VIEWPORT_PROFILES.DESKTOP;
  }

  return window.matchMedia('(max-width: 767px)').matches
    ? VIEWPORT_PROFILES.MOBILE
    : VIEWPORT_PROFILES.DESKTOP;
}

export function getStartupViewportForProfile(appSettings, profile) {
  const settings = appSettings || {};
  const mobileViewport = settings.startupViewportMobile;
  const desktopViewport = settings.startupViewportDesktop;
  const legacyViewport = settings.startupViewport;

  if (profile === VIEWPORT_PROFILES.MOBILE) {
    return mobileViewport || legacyViewport || desktopViewport || DEFAULT_VIEWPORT;
  }

  return desktopViewport || legacyViewport || mobileViewport || DEFAULT_VIEWPORT;
}

export function createStartupViewportPatch(profile, viewport) {
  if (profile === VIEWPORT_PROFILES.MOBILE) {
    return {
      startupViewportMobile: viewport,
      startupViewport: viewport
    };
  }

  return {
    startupViewportDesktop: viewport,
    startupViewport: viewport
  };
}
