import { USER_SCHEMA } from './constants';
import { ScimError } from './errors';

export type CompareOp = 'eq' | 'ne' | 'co' | 'sw' | 'ew' | 'gt' | 'ge' | 'lt' | 'le';
export type FilterValue = string | number | boolean | null;

export interface AttrPath {
  schema?: string;
  attribute: string;
  subAttribute?: string;
  valueFilter?: FilterNode;
}

export type FilterNode =
  | { type: 'and' | 'or'; left: FilterNode; right: FilterNode }
  | { type: 'not'; filter: FilterNode }
  | { type: 'pr'; attr: AttrPath }
  | { type: 'cmp'; op: CompareOp; attr: AttrPath; value: FilterValue };

const COMPARE_OPS = new Set<CompareOp>(['eq', 'ne', 'co', 'sw', 'ew', 'gt', 'ge', 'lt', 'le']);
const CASE_EXACT = new Set(['id', 'externalId']);

type PathError = 'invalidFilter' | 'invalidPath' | 'invalidValue';

export function parseFilter(input: string): FilterNode {
  const parser = new Parser(input, 'invalidFilter');
  const node = parser.parseOr();
  parser.finish();
  return node;
}

export function parseAttributePath(input: string, errorType: PathError = 'invalidPath'): AttrPath {
  const parser = new Parser(input, errorType);
  const attr = parser.parseAttrPath();
  parser.finish();
  return attr;
}

export function matches(record: Record<string, unknown>, filter: FilterNode): boolean {
  switch (filter.type) {
    case 'and':
      return matches(record, filter.left) && matches(record, filter.right);
    case 'or':
      return matches(record, filter.left) || matches(record, filter.right);
    case 'not':
      return !matches(record, filter.filter);
    case 'pr':
      return valuesFor(record, filter.attr).length > 0;
    case 'cmp': {
      const values = valuesFor(record, filter.attr);
      if (values.length === 0) return filter.op === 'ne';
      const caseExact = CASE_EXACT.has(filter.attr.subAttribute ?? filter.attr.attribute);
      return values.some((value) => compare(filter.op, value, filter.value, caseExact));
    }
    default:
      return false;
  }
}

export function valuesFor(record: Record<string, unknown>, attr: AttrPath): unknown[] {
  if (attr.schema && attr.schema !== USER_SCHEMA) return [];
  const raw = record[attr.attribute];
  if (!isPresent(raw)) return [];

  if (Array.isArray(raw)) {
    let items = raw;
    if (attr.valueFilter) {
      items = items.filter((item) => isRecord(item) && matches(item, attr.valueFilter as FilterNode));
    }
    if (attr.subAttribute) {
      return items.flatMap((item) => {
        if (!isRecord(item)) return [];
        const value = item[attr.subAttribute as string];
        return isPresent(value) ? [value] : [];
      });
    }
    return items.filter((item) => isPresent(item));
  }

  if (isRecord(raw)) {
    if (attr.subAttribute) {
      const value = raw[attr.subAttribute];
      return isPresent(value) ? [value] : [];
    }
    return Object.values(raw).some((value) => isPresent(value)) ? [raw] : [];
  }

  if (attr.subAttribute) return [];
  return [raw];
}

export function compareResources(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  attr: AttrPath,
  order: 'ascending' | 'descending',
): number {
  const leftValue = valuesFor(left, attr)[0];
  const rightValue = valuesFor(right, attr)[0];
  const leftMissing = leftValue === undefined;
  const rightMissing = rightValue === undefined;
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;

  let compared = 0;
  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    compared = leftValue - rightValue;
  } else if (typeof leftValue === 'boolean' && typeof rightValue === 'boolean') {
    compared = Number(leftValue) - Number(rightValue);
  } else {
    compared = String(leftValue).toLowerCase().localeCompare(String(rightValue).toLowerCase());
  }
  return order === 'descending' ? -compared : compared;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.some((item) => isPresent(item));
  if (isRecord(value)) return Object.values(value).some((item) => isPresent(item));
  return true;
}

function compare(op: CompareOp, actual: unknown, expected: FilterValue, caseExact: boolean): boolean {
  if (expected === null) {
    const actualNull = actual === null;
    if (op === 'eq') return actualNull;
    if (op === 'ne') return !actualNull;
    return false;
  }
  if (typeof expected === 'boolean') {
    if (typeof actual !== 'boolean') return op === 'ne';
    if (op === 'eq') return actual === expected;
    if (op === 'ne') return actual !== expected;
    return false;
  }
  if (typeof expected === 'number') {
    if (typeof actual !== 'number' || Number.isNaN(actual)) return op === 'ne';
    if (op === 'eq') return actual === expected;
    if (op === 'ne') return actual !== expected;
    if (op === 'gt') return actual > expected;
    if (op === 'ge') return actual >= expected;
    if (op === 'lt') return actual < expected;
    if (op === 'le') return actual <= expected;
    return false;
  }
  if (typeof actual !== 'string') return op === 'ne';
  const left = caseExact ? actual : actual.toLowerCase();
  const right = caseExact ? expected : expected.toLowerCase();
  if (op === 'eq') return left === right;
  if (op === 'ne') return left !== right;
  if (op === 'co') return left.includes(right);
  if (op === 'sw') return left.startsWith(right);
  if (op === 'ew') return left.endsWith(right);
  if (op === 'gt') return left > right;
  if (op === 'ge') return left >= right;
  if (op === 'lt') return left < right;
  if (op === 'le') return left <= right;
  return false;
}

class Parser {
  private index = 0;
  private readonly input: string;
  private readonly errorType: PathError;

  constructor(input: string, errorType: PathError) {
    this.input = input;
    this.errorType = errorType;
  }

  finish(): void {
    this.skip();
    if (this.index < this.input.length) {
      throw this.error(`Unexpected text '${this.input.slice(this.index)}'`);
    }
  }

  parseOr(): FilterNode {
    let left = this.parseAnd();
    while (this.matchKeyword('or')) {
      const right = this.parseAnd();
      left = { type: 'or', left, right };
    }
    return left;
  }

  parseAttrPath(): AttrPath {
    this.skip();
    const raw = this.readAttrToken();
    const { schema, parts } = splitSchema(raw, this.errorType);
    if (parts.length < 1 || parts.length > 2) {
      throw this.error(`Invalid attribute path '${raw}'`);
    }
    const attribute = parts[0];
    let subAttribute = parts[1];
    let valueFilter: FilterNode | undefined;
    this.skip();
    if (this.input[this.index] === '[') {
      if (subAttribute) throw this.error('A value filter cannot follow a sub-attribute');
      this.index += 1;
      valueFilter = this.parseOr();
      this.skip();
      if (this.input[this.index] !== ']') throw this.error('Expected ]');
      this.index += 1;
      this.skip();
      if (this.input[this.index] === '.') {
        this.index += 1;
        const subRaw = this.readAttrToken();
        const sub = splitSchema(subRaw, this.errorType);
        if (sub.schema || sub.parts.length !== 1) throw this.error('Invalid sub-attribute');
        subAttribute = sub.parts[0];
      }
    }
    return { schema, attribute, subAttribute, valueFilter };
  }

  private parseAnd(): FilterNode {
    let left = this.parseNot();
    while (this.matchKeyword('and')) {
      const right = this.parseNot();
      left = { type: 'and', left, right };
    }
    return left;
  }

  private parseNot(): FilterNode {
    if (this.matchKeyword('not')) {
      return { type: 'not', filter: this.parseNot() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): FilterNode {
    this.skip();
    if (this.input[this.index] === '(') {
      this.index += 1;
      const inner = this.parseOr();
      this.skip();
      if (this.input[this.index] !== ')') throw this.error('Expected )');
      this.index += 1;
      return inner;
    }
    const attr = this.parseAttrPath();
    const op = this.peekIdent()?.toLowerCase();
    if (op === 'pr') {
      this.index += this.peekIdent()?.length ?? 0;
      return { type: 'pr', attr };
    }
    if (!op || !COMPARE_OPS.has(op as CompareOp)) {
      throw this.error('Expected a comparison operator');
    }
    this.index += op.length;
    return { type: 'cmp', op: op as CompareOp, attr, value: this.parseValue() };
  }

  private parseValue(): FilterValue {
    this.skip();
    const char = this.input[this.index];
    if (char === '"') return this.parseString();
    if (char === '-' || (char >= '0' && char <= '9')) return this.parseNumber();
    const ident = this.peekIdent();
    if (!ident) throw this.error('Expected a comparison value');
    const lower = ident.toLowerCase();
    if (lower === 'true' || lower === 'false' || lower === 'null') {
      this.index += ident.length;
      if (lower === 'true') return true;
      if (lower === 'false') return false;
      return null;
    }
    throw this.error('Expected a comparison value');
  }

  private parseString(): string {
    this.index += 1;
    let out = '';
    while (this.index < this.input.length) {
      const char = this.input[this.index];
      if (char === '"') {
        this.index += 1;
        return out;
      }
      if (char === '\\') {
        const next = this.input[this.index + 1];
        if (next === undefined) break;
        const escaped: Record<string, string> = {
          '"': '"',
          '\\': '\\',
          '/': '/',
          n: '\n',
          r: '\r',
          t: '\t',
          b: '\b',
          f: '\f',
        };
        out += escaped[next] ?? next;
        this.index += 2;
        continue;
      }
      out += char;
      this.index += 1;
    }
    throw this.error('Unterminated string');
  }

  private parseNumber(): number {
    const match = /^-?\d+(?:\.\d+)?/.exec(this.input.slice(this.index));
    if (!match) throw this.error('Invalid number');
    this.index += match[0].length;
    return Number(match[0]);
  }

  private readAttrToken(): string {
    this.skip();
    const start = this.index;
    if (this.input.startsWith('urn:', this.index)) {
      while (this.index < this.input.length && !/[\s[\]()]/.test(this.input[this.index])) this.index += 1;
    } else {
      const match = /^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)*/.exec(this.input.slice(this.index));
      if (!match) throw this.error('Expected an attribute path');
      this.index += match[0].length;
    }
    const raw = this.input.slice(start, this.index);
    if (!raw) throw this.error('Expected an attribute path');
    return raw;
  }

  private matchKeyword(word: string): boolean {
    const ident = this.peekIdent();
    if (!ident || ident.toLowerCase() !== word) return false;
    this.index += ident.length;
    return true;
  }

  private peekIdent(): string | null {
    this.skip();
    const match = /^[A-Za-z][A-Za-z0-9_-]*/.exec(this.input.slice(this.index));
    return match ? match[0] : null;
  }

  private skip(): void {
    while (this.index < this.input.length && /\s/.test(this.input[this.index])) this.index += 1;
  }

  private error(detail: string): ScimError {
    return new ScimError(400, detail, this.errorType);
  }
}

function splitSchema(raw: string, errorType: PathError): { schema?: string; parts: string[] } {
  if (!raw.startsWith('urn:')) return { parts: raw.split('.') };
  const match = /^(urn:.+):([A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)*)$/.exec(raw);
  if (!match) throw new ScimError(400, `Invalid schema path '${raw}'`, errorType);
  return { schema: match[1], parts: match[2].split('.') };
}

export function splitAttributeList(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quoted = false;
  let depth = 0;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"' && input[i - 1] !== '\\') quoted = !quoted;
    else if (!quoted && char === '[') depth += 1;
    else if (!quoted && char === ']') depth = Math.max(0, depth - 1);
    if (!quoted && depth === 0 && char === ',') {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}
