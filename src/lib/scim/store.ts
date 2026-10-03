import fs from 'node:fs';
import path from 'node:path';

import { ScimError } from './errors';
import type { StoredUser } from './types';

/**
 * SCIM users are stored in a JSON document, separate from the city simulation.
 * The game itself keeps city state in browser localStorage and has no user
 * directory. This file is the smallest server-side store the Users resource
 * needs. Override the path with SCIM_DATA_FILE; the default is
 * data/scim-users.json.
 */

interface Database {
  users: StoredUser[];
}

export function scimDataFile(): string {
  const configured = process.env.SCIM_DATA_FILE;
  if (configured && configured.trim()) return path.resolve(configured);
  return path.join(process.cwd(), 'data', 'scim-users.json');
}

export function etagOf(version: number): string {
  return `W/"${version}"`;
}

export function versionMatches(header: string, version: number): boolean {
  return header.split(',').some((part) => {
    const token = part.trim();
    if (token === '*') return true;
    const normalized = token.replace(/^W\//i, '').replaceAll('"', '');
    return normalized === String(version);
  });
}

function userNameKey(userName: string): string {
  return userName.toLowerCase();
}

function withStore<T>(fn: (db: Database) => { write: boolean; result: T }): T {
  const file = scimDataFile();
  const lockPath = `${file}.lock`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  acquireLock(lockPath);
  try {
    const db = readDatabase(file);
    const { write, result } = fn(db);
    if (write) writeDatabase(file, db);
    return result;
  } finally {
    releaseLock(lockPath);
  }
}

function readDatabase(file: string): Database {
  if (!fs.existsSync(file)) return { users: [] };
  const text = fs.readFileSync(file, 'utf8');
  if (text.trim() === '') return { users: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('SCIM user store contains invalid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as Database).users)) {
    throw new Error('SCIM user store is corrupt');
  }
  return parsed as Database;
}

function writeDatabase(file: string, db: Database): void {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(db, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

function acquireLock(lockPath: string): void {
  const deadline = Date.now() + 5000;
  while (true) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') throw err;
      try {
        const stat = fs.statSync(lockPath);
        if (Date.now() - stat.mtimeMs > 15000) {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() > deadline) {
        throw new Error('Timed out waiting for the SCIM user store lock');
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
}

function releaseLock(lockPath: string): void {
  try {
    fs.unlinkSync(lockPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

function cloneUser(user: StoredUser): StoredUser {
  return structuredClone(user);
}

export function readUsers(): StoredUser[] {
  return withStore((db) => ({
    write: false,
    result: db.users.map(cloneUser),
  }));
}

export function readUser(id: string): StoredUser | undefined {
  return withStore((db) => {
    const found = db.users.find((user) => user.id === id);
    return { write: false, result: found ? cloneUser(found) : undefined };
  });
}

export function insertUser(user: StoredUser): void {
  withStore((db) => {
    if (db.users.some((existing) => userNameKey(existing.userName) === userNameKey(user.userName))) {
      throw new ScimError(409, `userName '${user.userName}' is already in use`, 'uniqueness');
    }
    db.users.push(user);
    return { write: true, result: undefined };
  });
}

export function updateUser(
  id: string,
  ifMatch: string | null,
  mutate: (user: StoredUser) => void,
): StoredUser {
  return withStore((db) => {
    const user = db.users.find((candidate) => candidate.id === id);
    if (!user) throw new ScimError(404, `User ${id} not found`);
    if (ifMatch !== null && !versionMatches(ifMatch, user.version)) {
      throw new ScimError(412, 'Failed to update because the resource has changed');
    }
    mutate(user);
    if (db.users.some((existing) => existing.id !== user.id && userNameKey(existing.userName) === userNameKey(user.userName))) {
      throw new ScimError(409, `userName '${user.userName}' is already in use`, 'uniqueness');
    }
    return { write: true, result: cloneUser(user) };
  });
}

export function removeUser(id: string, ifMatch: string | null): void {
  withStore((db) => {
    const index = db.users.findIndex((user) => user.id === id);
    if (index === -1) throw new ScimError(404, `User ${id} not found`);
    if (ifMatch !== null && !versionMatches(ifMatch, db.users[index].version)) {
      throw new ScimError(412, 'Failed to delete because the resource has changed');
    }
    db.users.splice(index, 1);
    return { write: true, result: undefined };
  });
}
