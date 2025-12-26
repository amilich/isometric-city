// LocalStorage compression helpers
//
// Why this exists:
// - Browsers impose tight per-origin limits on localStorage (commonly ~5–10MB).
// - IsoCity state can get large (grid + history + multiple saves).
// - We transparently compress payloads while remaining backward compatible
//   with existing uncompressed saves.

import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

const PREFIX = 'lz:';

export function isCompressedStorageString(raw: string): boolean {
  return typeof raw === 'string' && raw.startsWith(PREFIX);
}

/**
 * Convert an arbitrary JS value to a string suitable for localStorage.
 *
 * Strategy:
 * 1) JSON.stringify
 * 2) UTF-16 compression (lz-string)
 * 3) Store whichever is smaller (compressed vs raw), with a prefix for detection
 */
export function serializeForStorage(value: unknown): string {
  const json = JSON.stringify(value);
  const compressed = PREFIX + compressToUTF16(json);

  // Store whichever representation is shorter to maximize chance of fitting in quota.
  return compressed.length < json.length ? compressed : json;
}

/**
 * Parse a localStorage string created by serializeForStorage.
 * Supports both compressed and legacy raw JSON.
 */
export function deserializeFromStorage<T>(raw: string): T {
  const json = isCompressedStorageString(raw)
    ? (decompressFromUTF16(raw.slice(PREFIX.length)) ?? '')
    : raw;

  if (!json) {
    throw new Error('Failed to decompress storage string');
  }

  return JSON.parse(json) as T;
}

/**
 * Safe variant of deserializeFromStorage.
 */
export function safeDeserializeFromStorage<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return deserializeFromStorage<T>(raw);
  } catch {
    return null;
  }
}
