'use client';

const DEVICE_KEY = 'brainAid.deviceId';
const USER_KEY = 'brainAid.user';
const PREMIUM_KEY = 'brainAid.premium';
const PASSAGE_TIP_KEY = 'brainAid.passageTip';
/** Bump to force every browser to drop stale pre-login sessions. */
const SCHEMA_KEY = 'brainAid.schema';
export const CLIENT_SCHEMA = '3-login';

function ensureSchema() {
  if (typeof window === 'undefined') return;
  const current = localStorage.getItem(SCHEMA_KEY);
  if (current === CLIENT_SCHEMA) return;
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PREMIUM_KEY);
  // New device id so old device-bound identities cannot resurrect
  localStorage.removeItem(DEVICE_KEY);
  localStorage.setItem(SCHEMA_KEY, CLIENT_SCHEMA);
}

/** First-time “P” cite tutorial — independent of login wipe. */
export function loadPassageTipSeen() {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(PASSAGE_TIP_KEY) === '1';
}

export function savePassageTipSeen() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PASSAGE_TIP_KEY, '1');
}

export function getDeviceId() {
  if (typeof window === 'undefined') return '';
  ensureSchema();
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, '');
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function loadUser() {
  if (typeof window === 'undefined') return null;
  ensureSchema();
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveUser(user) {
  ensureSchema();
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearUser() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PREMIUM_KEY);
}

export function loadPremium() {
  if (typeof window === 'undefined') return false;
  ensureSchema();
  return localStorage.getItem(PREMIUM_KEY) === '1';
}

export function savePremium(on) {
  ensureSchema();
  localStorage.setItem(PREMIUM_KEY, on ? '1' : '0');
}
