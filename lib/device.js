'use client';

const DEVICE_KEY = 'brainAid.deviceId';
const USER_KEY = 'brainAid.user';
const PREMIUM_KEY = 'brainAid.premium';

export function getDeviceId() {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, '');
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function loadUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function loadPremium() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PREMIUM_KEY) === '1';
}

export function savePremium(on) {
  localStorage.setItem(PREMIUM_KEY, on ? '1' : '0');
}
