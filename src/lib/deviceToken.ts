// Device token for guest player identification in multiplayer

const DEVICE_TOKEN_KEY = 'isocity-device-token';

export function getOrCreateDeviceToken(): string {
  if (typeof window === 'undefined') return '';
  
  let token = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (!token) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      token = crypto.randomUUID();
    } else {
      token = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
  }
  return token;
}

export function getDeviceToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(DEVICE_TOKEN_KEY) || '';
}
