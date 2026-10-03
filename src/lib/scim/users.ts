import { randomBytes, randomUUID, scryptSync } from 'node:crypto';

import { PATCH_SCHEMA, USER_SCHEMA } from './constants';
import { ScimError } from './errors';
import {
  compareResources,
  isRecord,
  matches,
  parseAttributePath,
  parseFilter,
  splitAttributeList,
  type AttrPath,
  type FilterNode,
} from './filter';
import { etagOf } from './store';
import {
  ADDRESS_FIELDS,
  MULTI_NAMES,
  NAME_FIELDS,
  SIMPLE_NAMES,
  type AddressAttribute,
  type AddressField,
  type MultiName,
  type MultiValuedAttribute,
  type NameAttribute,
  type NameField,
  type SimpleName,
  type StoredUser,
} from './types';

const MULTI_FIELDS = new Set(['value', 'display', 'type', 'primary']);
const READ_ONLY = new Set(['id', 'meta', 'groups', 'schemas']);

interface AttributeBag {
  userName?: string;
  active?: boolean;
  password?: string;
  passwordProvided: boolean;
  present: Set<string>;
  strings: Partial<Record<SimpleName, string>>;
  name?: NameAttribute;
  multi: Partial<Record<MultiName, MultiValuedAttribute[]>>;
  addresses?: AddressAttribute[];
}

export interface ListQuery {
  filter: string | null;
  startIndex: number;
  count: number;
  sortBy: string | null;
  sortOrder: 'ascending' | 'descending';
  attributes: string | null;
  excludedAttributes: string | null;
}

export function buildNewUser(body: unknown): StoredUser {
  const bag = readUserAttributes(body, 'full');
  const now = new Date().toISOString();
  const user: StoredUser = {
    id: randomUUID(),
    userName: bag.userName as string,
    active: bag.active ?? true,
    created: now,
    lastModified: now,
    version: 1,
  };
  applyBag(user, bag, 'replace');
  user.userName = bag.userName as string;
  user.active = bag.active ?? true;
  user.version = 1;
  user.created = now;
  user.lastModified = now;
  return user;
}

export function applyReplace(user: StoredUser, body: unknown): void {
  const bag = readUserAttributes(body, 'full');
  for (const key of SIMPLE_NAMES) delete user[key];
  delete user.name;
  delete user.addresses;
  for (const key of MULTI_NAMES) delete user[key];
  user.userName = bag.userName as string;
  user.active = bag.active ?? true;
  applyBag(user, bag, 'replace');
  // An omitted password is left untouched: clients never receive the hash, so a
  // replace that echoes the readable resource must not clear it. applyBag only
  // rewrites passwordHash when the request actually contains password.
  user.userName = bag.userName as string;
  user.active = bag.active ?? true;
  touch(user);
}

export function applyPatch(user: StoredUser, body: unknown): void {
  if (!isRecord(body)) throw new ScimError(400, 'Patch body must be an object', 'invalidSyntax');
  if ('schemas' in body && body.schemas !== undefined) {
    if (!Array.isArray(body.schemas) || !body.schemas.includes(PATCH_SCHEMA)) {
      throw new ScimError(400, 'Patch request must include the PatchOp schema', 'invalidValue');
    }
  }
  if (!Array.isArray(body.Operations) || body.Operations.length === 0) {
    throw new ScimError(400, 'Operations must be a non-empty array', 'invalidSyntax');
  }
  for (const operation of body.Operations) applyOperation(user, operation);
  touch(user);
}

export function toPublicUser(user: StoredUser, base: string): Record<string, unknown> {
  const resource: Record<string, unknown> = {
    schemas: [USER_SCHEMA],
    id: user.id,
    userName: user.userName,
    active: user.active,
    meta: {
      resourceType: 'User',
      created: user.created,
      lastModified: user.lastModified,
      location: `${base}/Users/${encodeURIComponent(user.id)}`,
      version: etagOf(user.version),
    },
  };
  for (const key of SIMPLE_NAMES) {
    if (user[key]) resource[key] = user[key];
  }
  if (user.name && Object.keys(user.name).length > 0) resource.name = { ...user.name };
  for (const key of MULTI_NAMES) {
    if (user[key] && user[key].length > 0) resource[key] = user[key].map((item) => ({ ...item }));
  }
  if (user.addresses && user.addresses.length > 0) {
    resource.addresses = user.addresses.map((item) => ({ ...item }));
  }
  return resource;
}

export function queryUsers(users: Record<string, unknown>[], query: ListQuery): Record<string, unknown>[] {
  let result = users;
  if (query.filter) {
    const expression = parseFilter(query.filter);
    result = result.filter((user) => matches(user, expression));
  }
  if (query.sortBy) {
    const attr = parseAttributePath(query.sortBy, 'invalidValue');
    result = [...result].sort((left, right) => compareResources(left, right, attr, query.sortOrder));
  }
  return result;
}

export function projectRecord(
  record: Record<string, unknown>,
  attributes: string | null,
  excludedAttributes: string | null,
  always: readonly string[],
): Record<string, unknown> {
  if (!attributes && !excludedAttributes) return record;
  if (attributes) {
    const paths = splitAttributeList(attributes).map((path) => parseAttributePath(path, 'invalidValue'));
    const projected: Record<string, unknown> = {};
    for (const key of always) {
      if (record[key] !== undefined) projected[key] = structuredClone(record[key]);
    }
    for (const path of paths) includePath(record, projected, path);
    return projected;
  }
  const copy = structuredClone(record);
  const paths = splitAttributeList(excludedAttributes as string).map((path) => parseAttributePath(path, 'invalidValue'));
  for (const path of paths) {
    if (always.includes(path.attribute) && !path.subAttribute && !path.valueFilter) continue;
    excludePath(copy, path);
  }
  return copy;
}

function applyOperation(user: StoredUser, operation: unknown): void {
  if (!isRecord(operation)) throw new ScimError(400, 'Each patch operation must be an object', 'invalidSyntax');
  if (typeof operation.op !== 'string' || operation.op.trim() === '') {
    throw new ScimError(400, 'Patch operation op is required', 'invalidSyntax');
  }
  const op = operation.op.trim().toLowerCase();
  if (op !== 'add' && op !== 'remove' && op !== 'replace') {
    throw new ScimError(400, `Unsupported patch op '${operation.op}'`, 'invalidSyntax');
  }
  if (operation.path !== undefined && typeof operation.path !== 'string') {
    throw new ScimError(400, 'Patch path must be a string', 'invalidPath');
  }
  const path = typeof operation.path === 'string' ? operation.path : undefined;
  if (op === 'remove') {
    if (!path) throw new ScimError(400, 'path is required for remove', 'noTarget');
    removeAttribute(user, parseAttributePath(path, 'invalidPath'));
    return;
  }
  if (!('value' in operation)) throw new ScimError(400, `value is required for ${op}`, 'invalidSyntax');
  if (!path) {
    applyBag(user, readUserAttributes(operation.value, 'partial'), op);
    return;
  }
  setAttribute(user, parseAttributePath(path, 'invalidPath'), operation.value, op);
}

function applyBag(user: StoredUser, bag: AttributeBag, op: 'add' | 'replace'): void {
  if (bag.userName !== undefined) user.userName = bag.userName;
  if (bag.active !== undefined) user.active = bag.active;
  for (const key of SIMPLE_NAMES) {
    if (!bag.present.has(key)) continue;
    const value = bag.strings[key];
    if (value === undefined) delete user[key];
    else user[key] = value;
  }
  if (bag.present.has('name')) {
    if (!bag.name || Object.keys(bag.name).length === 0) delete user.name;
    else if (op === 'add' && user.name) user.name = { ...user.name, ...bag.name };
    else user.name = bag.name;
  }
  for (const key of MULTI_NAMES) {
    if (!bag.present.has(key)) continue;
    const incoming = bag.multi[key] ?? [];
    if (op === 'replace' || !user[key]) user[key] = incoming;
    else user[key] = mergeMulti(user[key] ?? [], incoming);
  }
  if (bag.present.has('addresses')) {
    const incoming = bag.addresses ?? [];
    if (op === 'replace' || !user.addresses) user.addresses = incoming;
    else user.addresses = mergeAddresses(user.addresses, incoming);
  }
  if (bag.passwordProvided) {
    if (bag.password) user.passwordHash = hashPassword(bag.password);
    else delete user.passwordHash;
  }
}

function setAttribute(user: StoredUser, attr: AttrPath, value: unknown, op: 'add' | 'replace'): void {
  assertWritable(attr);
  const { attribute } = attr;
  if (attribute === 'password') {
    if (attr.subAttribute || attr.valueFilter) throw new ScimError(400, 'Invalid password path', 'invalidPath');
    if (typeof value !== 'string') throw new ScimError(400, 'password must be a string', 'invalidValue');
    if (value.length > 1024) throw new ScimError(400, 'password is too long', 'invalidValue');
    if (value.length === 0) delete user.passwordHash;
    else user.passwordHash = hashPassword(value);
    return;
  }
  if (attribute === 'active') {
    if (attr.subAttribute || attr.valueFilter) throw new ScimError(400, 'Invalid active path', 'invalidPath');
    if (typeof value !== 'boolean') throw new ScimError(400, 'active must be a boolean', 'invalidValue');
    user.active = value;
    return;
  }
  if (attribute === 'userName') {
    if (attr.subAttribute || attr.valueFilter) throw new ScimError(400, 'Invalid userName path', 'invalidPath');
    user.userName = requireUserName(value);
    return;
  }
  if (attribute === 'name') {
    setName(user, attr, value, op);
    return;
  }
  if (attribute === 'addresses') {
    setAddresses(user, attr, value, op);
    return;
  }
  if (isSimpleName(attribute)) {
    if (attr.subAttribute || attr.valueFilter) throw new ScimError(400, `Invalid path for ${attribute}`, 'invalidPath');
    const text = optionalText(value, attribute);
    if (!text) delete user[attribute];
    else user[attribute] = text;
    return;
  }
  if (isMultiName(attribute)) {
    setMulti(user, attribute, attr, value, op);
    return;
  }
  throw new ScimError(400, `Unknown attribute '${attribute}'`, 'invalidPath');
}

function removeAttribute(user: StoredUser, attr: AttrPath): void {
  assertWritable(attr);
  const { attribute } = attr;
  if (attribute === 'userName') throw new ScimError(400, 'userName is required', 'invalidValue');
  if (attribute === 'password') {
    if (!user.passwordHash) throw noTarget('password');
    delete user.passwordHash;
    return;
  }
  if (attribute === 'active') {
    user.active = true;
    return;
  }
  if (attribute === 'name') {
    removeName(user, attr);
    return;
  }
  if (attribute === 'addresses') {
    removeAddresses(user, attr);
    return;
  }
  if (isSimpleName(attribute)) {
    if (attr.subAttribute || attr.valueFilter) throw new ScimError(400, `Invalid path for ${attribute}`, 'invalidPath');
    if (user[attribute] === undefined) throw noTarget(attribute);
    delete user[attribute];
    return;
  }
  if (isMultiName(attribute)) {
    removeMulti(user, attribute, attr);
    return;
  }
  throw new ScimError(400, `Unknown attribute '${attribute}'`, 'invalidPath');
}

function setName(user: StoredUser, attr: AttrPath, value: unknown, op: 'add' | 'replace'): void {
  if (attr.valueFilter) throw new ScimError(400, 'name does not support a value filter', 'invalidPath');
  if (attr.subAttribute) {
    const field = nameField(attr.subAttribute);
    const text = optionalText(value, `name.${field}`);
    if (!text) throw new ScimError(400, `name.${field} must be a non-empty string`, 'invalidValue');
    user.name = { ...(user.name ?? {}), [field]: text };
    return;
  }
  const name = parseName(value);
  if (op === 'add' && user.name) user.name = { ...user.name, ...name };
  else user.name = name;
}

function removeName(user: StoredUser, attr: AttrPath): void {
  if (!user.name) throw noTarget('name');
  if (attr.valueFilter) throw new ScimError(400, 'name does not support a value filter', 'invalidPath');
  if (!attr.subAttribute) {
    delete user.name;
    return;
  }
  const field = nameField(attr.subAttribute);
  if (user.name[field] === undefined) throw noTarget(`name.${field}`);
  delete user.name[field];
  if (Object.keys(user.name).length === 0) delete user.name;
}

function setMulti(
  user: StoredUser,
  key: MultiName,
  attr: AttrPath,
  value: unknown,
  op: 'add' | 'replace',
): void {
  if (attr.valueFilter) {
    const current = user[key] ?? [];
    const matched = current.filter((item) => matches(itemAsRecord(item), attr.valueFilter as FilterNode));
    if (matched.length === 0) throw noTarget(key);
    if (!attr.subAttribute) {
      throw new ScimError(400, `Path must include a sub-attribute to update ${key}`, 'invalidPath');
    }
    for (const item of matched) writeMultiField(item, attr.subAttribute, value, key);
    user[key] = current;
    return;
  }
  if (attr.subAttribute) {
    throw new ScimError(400, `Cannot target ${key}.${attr.subAttribute} without a value filter`, 'invalidPath');
  }
  const incoming = parseMulti(value, key);
  if (op === 'replace') user[key] = incoming;
  else user[key] = mergeMulti(user[key] ?? [], incoming);
}

function removeMulti(user: StoredUser, key: MultiName, attr: AttrPath): void {
  const current = user[key];
  if (!current || current.length === 0) throw noTarget(key);
  if (!attr.valueFilter && !attr.subAttribute) {
    delete user[key];
    return;
  }
  if (attr.subAttribute && !attr.valueFilter) {
    throw new ScimError(400, `Cannot target ${key}.${attr.subAttribute} without a value filter`, 'invalidPath');
  }
  let removed = 0;
  const next: MultiValuedAttribute[] = [];
  for (const item of current) {
    const isMatch = attr.valueFilter ? matches(itemAsRecord(item), attr.valueFilter) : true;
    if (!isMatch) {
      next.push(item);
      continue;
    }
    if (!attr.subAttribute) {
      removed += 1;
      continue;
    }
    if (item[attr.subAttribute as keyof MultiValuedAttribute] === undefined) {
      next.push(item);
      continue;
    }
    const copy: MultiValuedAttribute = { ...item };
    delete copy[attr.subAttribute as 'display' | 'type' | 'primary'];
    if (attr.subAttribute === 'value') {
      removed += 1;
      continue;
    }
    removed += 1;
    next.push(copy);
  }
  if (removed === 0) throw noTarget(key);
  if (next.length === 0) delete user[key];
  else user[key] = next;
}

function setAddresses(user: StoredUser, attr: AttrPath, value: unknown, op: 'add' | 'replace'): void {
  if (attr.valueFilter) {
    const current = user.addresses ?? [];
    const matched = current.filter((item) => matches(item as unknown as Record<string, unknown>, attr.valueFilter as FilterNode));
    if (matched.length === 0) throw noTarget('addresses');
    if (!attr.subAttribute) throw new ScimError(400, 'Path must include a sub-attribute to update addresses', 'invalidPath');
    for (const item of matched) writeAddressField(item, attr.subAttribute, value);
    user.addresses = current;
    return;
  }
  if (attr.subAttribute) throw new ScimError(400, 'Cannot target addresses without a value filter', 'invalidPath');
  const incoming = parseAddresses(value);
  if (op === 'replace') user.addresses = incoming;
  else user.addresses = mergeAddresses(user.addresses ?? [], incoming);
}

function removeAddresses(user: StoredUser, attr: AttrPath): void {
  const current = user.addresses;
  if (!current || current.length === 0) throw noTarget('addresses');
  if (!attr.valueFilter && !attr.subAttribute) {
    delete user.addresses;
    return;
  }
  let removed = 0;
  const next: AddressAttribute[] = [];
  for (const item of current) {
    const isMatch = attr.valueFilter
      ? matches(item as unknown as Record<string, unknown>, attr.valueFilter)
      : true;
    if (!isMatch) {
      next.push(item);
      continue;
    }
    if (!attr.subAttribute) {
      removed += 1;
      continue;
    }
    if (item[attr.subAttribute as AddressField] === undefined && attr.subAttribute !== 'primary') {
      next.push(item);
      continue;
    }
    const copy = { ...item };
    if (attr.subAttribute === 'primary') delete copy.primary;
    else delete copy[attr.subAttribute as AddressField];
    if (!addressHasData(copy)) {
      removed += 1;
      continue;
    }
    removed += 1;
    next.push(copy);
  }
  if (removed === 0) throw noTarget('addresses');
  if (next.length === 0) delete user.addresses;
  else user.addresses = next;
}

function readUserAttributes(body: unknown, mode: 'full' | 'partial'): AttributeBag {
  if (!isRecord(body)) throw new ScimError(400, 'Request body must be a JSON object', 'invalidSyntax');
  if ('schemas' in body && body.schemas !== undefined) {
    if (!Array.isArray(body.schemas) || body.schemas.some((item) => typeof item !== 'string')) {
      throw new ScimError(400, 'schemas must be an array of strings', 'invalidValue');
    }
    if (mode === 'full' && !body.schemas.includes(USER_SCHEMA)) {
      throw new ScimError(400, 'Request must include the core User schema', 'invalidValue');
    }
  }
  const bag: AttributeBag = {
    passwordProvided: false,
    present: new Set<string>(),
    strings: {},
    multi: {},
  };
  if ('userName' in body) {
    bag.userName = requireUserName(body.userName);
    bag.present.add('userName');
  }
  if ('active' in body) {
    if (typeof body.active !== 'boolean') throw new ScimError(400, 'active must be a boolean', 'invalidValue');
    bag.active = body.active;
    bag.present.add('active');
  }
  if ('password' in body) {
    if (typeof body.password !== 'string') throw new ScimError(400, 'password must be a string', 'invalidValue');
    if (body.password.length > 1024) throw new ScimError(400, 'password is too long', 'invalidValue');
    bag.password = body.password;
    bag.passwordProvided = true;
    bag.present.add('password');
  }
  for (const key of SIMPLE_NAMES) {
    if (!(key in body)) continue;
    const text = optionalText(body[key], key);
    if (text) bag.strings[key] = text;
    bag.present.add(key);
  }
  if ('name' in body) {
    bag.name = parseName(body.name);
    bag.present.add('name');
  }
  for (const key of MULTI_NAMES) {
    if (!(key in body)) continue;
    bag.multi[key] = parseMulti(body[key], key);
    bag.present.add(key);
  }
  if ('addresses' in body) {
    bag.addresses = parseAddresses(body.addresses);
    bag.present.add('addresses');
  }
  if (mode === 'full' && !bag.userName) throw new ScimError(400, 'userName is required', 'invalidValue');
  if (mode === 'full' && bag.active === undefined) bag.active = true;
  return bag;
}

function parseName(value: unknown): NameAttribute {
  if (!isRecord(value)) throw new ScimError(400, 'name must be an object', 'invalidValue');
  const name: NameAttribute = {};
  for (const field of NAME_FIELDS) {
    if (!(field in value) || value[field] === undefined) continue;
    const text = optionalText(value[field], `name.${field}`);
    if (text) name[field] = text;
  }
  if (Object.keys(name).length === 0) throw new ScimError(400, 'name must include at least one attribute', 'invalidValue');
  return name;
}

function parseMulti(value: unknown, label: string): MultiValuedAttribute[] {
  const items = Array.isArray(value) ? value : [value];
  if (items.length > 100) throw new ScimError(400, `${label} has too many values`, 'invalidValue');
  return items.map((item, index) => {
    if (!isRecord(item)) throw new ScimError(400, `${label}[${index}] must be an object`, 'invalidValue');
    if (typeof item.value !== 'string' || item.value.length === 0) {
      throw new ScimError(400, `${label}[${index}].value must be a non-empty string`, 'invalidValue');
    }
    const parsed: MultiValuedAttribute = { value: item.value };
    if ('display' in item && item.display !== undefined) {
      const display = optionalText(item.display, `${label}[${index}].display`);
      if (display) parsed.display = display;
    }
    if ('type' in item && item.type !== undefined) {
      const type = optionalText(item.type, `${label}[${index}].type`);
      if (type) parsed.type = type;
    }
    if ('primary' in item && item.primary !== undefined) {
      if (typeof item.primary !== 'boolean') {
        throw new ScimError(400, `${label}[${index}].primary must be a boolean`, 'invalidValue');
      }
      parsed.primary = item.primary;
    }
    return parsed;
  });
}

function parseAddresses(value: unknown): AddressAttribute[] {
  const items = Array.isArray(value) ? value : [value];
  if (items.length > 100) throw new ScimError(400, 'addresses has too many values', 'invalidValue');
  return items.map((item, index) => {
    if (!isRecord(item)) throw new ScimError(400, `addresses[${index}] must be an object`, 'invalidValue');
    const parsed: AddressAttribute = {};
    for (const field of ADDRESS_FIELDS) {
      if (!(field in item) || item[field] === undefined) continue;
      const text = optionalText(item[field], `addresses[${index}].${field}`);
      if (text) parsed[field] = text;
    }
    if ('primary' in item && item.primary !== undefined) {
      if (typeof item.primary !== 'boolean') {
        throw new ScimError(400, `addresses[${index}].primary must be a boolean`, 'invalidValue');
      }
      parsed.primary = item.primary;
    }
    if (!addressHasData(parsed)) {
      throw new ScimError(400, `addresses[${index}] must include an address attribute`, 'invalidValue');
    }
    return parsed;
  });
}

function writeMultiField(item: MultiValuedAttribute, field: string, value: unknown, label: string): void {
  if (!MULTI_FIELDS.has(field)) throw new ScimError(400, `Unknown sub-attribute '${field}'`, 'invalidPath');
  if (field === 'primary') {
    if (typeof value !== 'boolean') throw new ScimError(400, `${label}.primary must be a boolean`, 'invalidValue');
    item.primary = value;
    return;
  }
  const text = optionalText(value, `${label}.${field}`);
  if (!text) throw new ScimError(400, `${label}.${field} must be a non-empty string`, 'invalidValue');
  if (field === 'value') item.value = text;
  if (field === 'display') item.display = text;
  if (field === 'type') item.type = text;
}

function writeAddressField(item: AddressAttribute, field: string, value: unknown): void {
  if (field === 'primary') {
    if (typeof value !== 'boolean') throw new ScimError(400, 'addresses.primary must be a boolean', 'invalidValue');
    item.primary = value;
    return;
  }
  if (!ADDRESS_FIELDS.includes(field as AddressField)) {
    throw new ScimError(400, `Unknown sub-attribute '${field}'`, 'invalidPath');
  }
  const text = optionalText(value, `addresses.${field}`);
  if (!text) throw new ScimError(400, `addresses.${field} must be a non-empty string`, 'invalidValue');
  item[field as AddressField] = text;
}

function includePath(source: Record<string, unknown>, target: Record<string, unknown>, path: AttrPath): void {
  if (path.schema && path.schema !== USER_SCHEMA) return;
  const raw = source[path.attribute];
  if (raw === undefined) return;
  if (!path.subAttribute && !path.valueFilter) {
    target[path.attribute] = structuredClone(raw);
    return;
  }
  if (Array.isArray(raw)) {
    const projected: Record<string, unknown>[] = [];
    for (const item of raw) {
      if (!isRecord(item)) continue;
      if (path.valueFilter && !matches(item, path.valueFilter)) continue;
      if (!path.subAttribute) {
        projected.push(structuredClone(item));
        continue;
      }
      const value = item[path.subAttribute];
      if (value === undefined) continue;
      projected.push({ [path.subAttribute]: structuredClone(value) });
    }
    if (projected.length > 0) target[path.attribute] = projected;
    return;
  }
  if (isRecord(raw) && path.subAttribute) {
    const value = raw[path.subAttribute];
    if (value === undefined) return;
    const current = target[path.attribute];
    const existing: Record<string, unknown> = isRecord(current) ? { ...current } : {};
    existing[path.subAttribute] = structuredClone(value);
    target[path.attribute] = existing;
  }
}

function excludePath(record: Record<string, unknown>, path: AttrPath): void {
  if (path.schema && path.schema !== USER_SCHEMA) return;
  if (!(path.attribute in record)) return;
  const raw = record[path.attribute];
  if (!path.subAttribute && !path.valueFilter) {
    delete record[path.attribute];
    return;
  }
  if (Array.isArray(raw)) {
    const next = raw.flatMap((item) => {
      if (!isRecord(item)) return [item];
      if (path.valueFilter && !matches(item, path.valueFilter)) return [item];
      if (!path.subAttribute) return [];
      const copy = { ...item };
      delete copy[path.subAttribute];
      return [copy];
    });
    record[path.attribute] = next;
    return;
  }
  if (isRecord(raw) && path.subAttribute) delete raw[path.subAttribute];
}

function mergeMulti(current: MultiValuedAttribute[], incoming: MultiValuedAttribute[]): MultiValuedAttribute[] {
  const next = current.map((item) => ({ ...item }));
  for (const item of incoming) {
    if (!next.some((existing) => existing.value === item.value && (existing.type ?? '') === (item.type ?? ''))) {
      next.push(item);
    }
  }
  return next;
}

function mergeAddresses(current: AddressAttribute[], incoming: AddressAttribute[]): AddressAttribute[] {
  const next = current.map((item) => ({ ...item }));
  for (const item of incoming) {
    const key = addressKey(item);
    if (!next.some((existing) => addressKey(existing) === key)) next.push(item);
  }
  return next;
}

function addressKey(address: AddressAttribute): string {
  return ADDRESS_FIELDS.map((field) => address[field] ?? '').join('|');
}

function addressHasData(address: AddressAttribute): boolean {
  return ADDRESS_FIELDS.some((field) => Boolean(address[field])) || typeof address.primary === 'boolean';
}

function itemAsRecord(item: MultiValuedAttribute): Record<string, unknown> {
  return item as unknown as Record<string, unknown>;
}

function assertWritable(attr: AttrPath): void {
  if (attr.schema && attr.schema !== USER_SCHEMA) {
    throw new ScimError(400, `Unsupported schema '${attr.schema}'`, 'invalidPath');
  }
  if (READ_ONLY.has(attr.attribute)) {
    throw new ScimError(400, `${attr.attribute} is read-only`, 'mutability');
  }
}

function requireUserName(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > 256) {
    throw new ScimError(400, 'userName must be a non-empty string', 'invalidValue');
  }
  return value;
}

function optionalText(value: unknown, label: string): string | undefined {
  if (typeof value !== 'string') throw new ScimError(400, `${label} must be a string`, 'invalidValue');
  if (value.length > 2048) throw new ScimError(400, `${label} is too long`, 'invalidValue');
  return value.length > 0 ? value : undefined;
}

function nameField(field: string): NameField {
  if (!NAME_FIELDS.includes(field as NameField)) throw new ScimError(400, `Unknown name attribute '${field}'`, 'invalidPath');
  return field as NameField;
}

function isSimpleName(value: string): value is SimpleName {
  return (SIMPLE_NAMES as readonly string[]).includes(value);
}

function isMultiName(value: string): value is MultiName {
  return (MULTI_NAMES as readonly string[]).includes(value);
}

function noTarget(attribute: string): ScimError {
  return new ScimError(400, `Attribute '${attribute}' was not found`, 'noTarget');
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

function touch(user: StoredUser): void {
  user.lastModified = new Date().toISOString();
  user.version += 1;
}

export function parseListQuery(url: URL, defaults?: { count?: number }): ListQuery {
  const attributes = cleanParam(url.searchParams.get('attributes'));
  const excludedAttributes = cleanParam(url.searchParams.get('excludedAttributes'));
  if (attributes && excludedAttributes) {
    throw new ScimError(400, 'attributes and excludedAttributes are mutually exclusive', 'invalidValue');
  }
  const startRaw = url.searchParams.get('startIndex');
  let startIndex = 1;
  if (startRaw !== null && startRaw.trim() !== '') {
    startIndex = parseInteger('startIndex', startRaw);
    if (startIndex < 1) startIndex = 1;
  }
  const countRaw = url.searchParams.get('count');
  let count = defaults?.count ?? 100;
  if (countRaw !== null && countRaw.trim() !== '') {
    count = parseInteger('count', countRaw);
    if (count < 0) throw new ScimError(400, 'count must be greater than or equal to 0', 'invalidValue');
    if (count > 200) count = 200;
  }
  const sortOrderRaw = cleanParam(url.searchParams.get('sortOrder'));
  let sortOrder: 'ascending' | 'descending' = 'ascending';
  if (sortOrderRaw) {
    const normalized = sortOrderRaw.toLowerCase();
    if (normalized !== 'ascending' && normalized !== 'descending') {
      throw new ScimError(400, 'sortOrder must be ascending or descending', 'invalidValue');
    }
    sortOrder = normalized;
  }
  return {
    filter: cleanParam(url.searchParams.get('filter')),
    startIndex,
    count,
    sortBy: cleanParam(url.searchParams.get('sortBy')),
    sortOrder,
    attributes,
    excludedAttributes,
  };
}

function parseInteger(name: string, raw: string): number {
  if (!/^-?\d+$/.test(raw.trim())) throw new ScimError(400, `${name} must be an integer`, 'invalidValue');
  return Number(raw);
}

function cleanParam(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
