import {
  resolveVariablePath,
  resolveVariableReferences,
  setScopedVariable,
  type VariableScope,
} from '../../shared/domain/variables';
import type { FlowNode } from '../../shared/domain/flow-graph';
import type { FlowExecutionContext } from './flow-execution-context';

const SINGLE_VARIABLE_PATTERN = /^\$\{([^{}]+)\}$/;

function resolveConfigBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }

  return Boolean(value);
}

function resolveConfigString(value: unknown, scope: VariableScope): string {
  const raw = value === undefined || value === null ? '' : String(value);
  return resolveVariableReferences(raw, scope);
}

export function resolveConfigValue(value: unknown, scope: VariableScope): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  const singleVariableMatch = SINGLE_VARIABLE_PATTERN.exec(trimmed);
  if (singleVariableMatch) {
    const resolved = resolveVariablePath(singleVariableMatch[1], scope);
    if (resolved !== undefined) {
      return resolved;
    }
  }

  return resolveVariableReferences(trimmed, scope);
}

function resolveConfigNumber(value: unknown, scope: VariableScope, label: string): number {
  const resolved = resolveConfigValue(value, scope);
  const numeric =
    typeof resolved === 'number'
      ? resolved
      : Number(typeof resolved === 'string' ? resolved.trim() : resolved);

  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid ${label}: ${String(resolved)}`);
  }

  return numeric;
}

export function resolveConfigInteger(
  value: unknown,
  scope: VariableScope,
  label: string,
  minimum = 0,
): number {
  const numeric = resolveConfigNumber(value, scope, label);
  const integer = Math.trunc(numeric);

  if (integer < minimum) {
    throw new Error(`${label} must be at least ${minimum}.`);
  }

  return integer;
}

function storeResult(
  context: FlowExecutionContext,
  scope: VariableScope,
  storeAs: string,
  value: unknown,
): void {
  if (!storeAs.trim()) {
    throw new Error('Store as variable name is required.');
  }

  const target = setScopedVariable(scope, storeAs, value);
  if (target === 'global') {
    context.globalVariableStore.scheduleSave();
  }
}

function createFieldAccessors(node: FlowNode, scope: VariableScope) {
  return {
    string(fieldId: string): string {
      return resolveConfigString(node.config[fieldId], scope);
    },
    value(fieldId: string): unknown {
      return resolveConfigValue(node.config[fieldId], scope);
    },
    number(fieldId: string, label: string): number {
      return resolveConfigNumber(node.config[fieldId], scope, label);
    },
    integer(fieldId: string, label: string, minimum = 0): number {
      return resolveConfigInteger(node.config[fieldId], scope, label, minimum);
    },
    boolean(fieldId: string): boolean {
      return resolveConfigBoolean(node.config[fieldId]);
    },
  };
}

function evaluateMath(left: number, operator: string, right: number): number {
  switch (operator) {
    case 'add':
      return left + right;
    case 'subtract':
      return left - right;
    case 'multiply':
      return left * right;
    case 'divide':
      if (right === 0) {
        throw new Error('Cannot divide by zero.');
      }
      return left / right;
    case 'modulo':
      if (right === 0) {
        throw new Error('Cannot calculate modulo with a divisor of zero.');
      }
      return left % right;
    case 'power':
      return left ** right;
    default:
      throw new Error(`Unsupported math operator: ${operator}`);
  }
}

function randomInteger(min: number, max: number): number {
  const lower = Math.ceil(Math.min(min, max));
  const upper = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

function buildRandomStringCharset(options: {
  includeNumbers: boolean;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeSymbols: boolean;
}): string {
  let charset = '';

  if (options.includeNumbers) {
    charset += '0123456789';
  }
  if (options.includeUppercase) {
    charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }
  if (options.includeLowercase) {
    charset += 'abcdefghijklmnopqrstuvwxyz';
  }
  if (options.includeSymbols) {
    charset += '!@#$%^&*()-_=+[]{}|;:,.<>?';
  }

  if (charset.length === 0) {
    charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  }

  return charset;
}

function generateRandomString(length: number, charset: string): string {
  let result = '';

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    result += charset[randomIndex];
  }

  return result;
}

function getWeekNumber(date: Date): number {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const WEEKDAY_SHORT_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDateTime(format: string, date: Date): string {
  const tokens: Array<{ token: string; value: string }> = [
    { token: 'YYYY', value: String(date.getFullYear()) },
    { token: 'YY', value: String(date.getFullYear()).slice(-2) },
    { token: 'MM', value: String(date.getMonth() + 1).padStart(2, '0') },
    { token: 'DD', value: String(date.getDate()).padStart(2, '0') },
    { token: 'HH', value: String(date.getHours()).padStart(2, '0') },
    { token: 'mm', value: String(date.getMinutes()).padStart(2, '0') },
    { token: 'ss', value: String(date.getSeconds()).padStart(2, '0') },
    { token: 'dddd', value: WEEKDAY_NAMES[date.getDay()] ?? '' },
    { token: 'ddd', value: WEEKDAY_SHORT_NAMES[date.getDay()] ?? '' },
    { token: 'ww', value: String(getWeekNumber(date)).padStart(2, '0') },
    { token: 'unixMs', value: String(date.getTime()) },
    { token: 'unix', value: String(Math.floor(date.getTime() / 1000)) },
    { token: 'M', value: String(date.getMonth() + 1) },
    { token: 'D', value: String(date.getDate()) },
    { token: 'H', value: String(date.getHours()) },
    { token: 'm', value: String(date.getMinutes()) },
    { token: 's', value: String(date.getSeconds()) },
    { token: 'W', value: String(getWeekNumber(date)) },
  ];

  let result = format;
  for (const entry of tokens) {
    result = result.split(entry.token).join(entry.value);
  }

  return result;
}

function convertValue(value: unknown, conversion: string): unknown {
  const numeric = Number(typeof value === 'string' ? value.trim() : value);

  switch (conversion) {
    case 'number-to-string':
      return String(value ?? '');
    case 'string-to-number':
      if (!Number.isFinite(numeric)) {
        throw new Error(`Cannot convert "${String(value)}" to a number.`);
      }
      return numeric;
    case 'celsius-to-fahrenheit':
      if (!Number.isFinite(numeric)) {
        throw new Error('Temperature conversion requires a numeric value.');
      }
      return numeric * (9 / 5) + 32;
    case 'fahrenheit-to-celsius':
      if (!Number.isFinite(numeric)) {
        throw new Error('Temperature conversion requires a numeric value.');
      }
      return (numeric - 32) * (5 / 9);
    case 'kilometres-to-miles':
      if (!Number.isFinite(numeric)) {
        throw new Error('Distance conversion requires a numeric value.');
      }
      return numeric * 0.621371;
    case 'miles-to-kilometres':
      if (!Number.isFinite(numeric)) {
        throw new Error('Distance conversion requires a numeric value.');
      }
      return numeric / 0.621371;
    case 'seconds-to-milliseconds':
      if (!Number.isFinite(numeric)) {
        throw new Error('Time conversion requires a numeric value.');
      }
      return numeric * 1000;
    case 'milliseconds-to-seconds':
      if (!Number.isFinite(numeric)) {
        throw new Error('Time conversion requires a numeric value.');
      }
      return numeric / 1000;
    case 'metres-to-feet':
      if (!Number.isFinite(numeric)) {
        throw new Error('Length conversion requires a numeric value.');
      }
      return numeric * 3.28084;
    case 'feet-to-metres':
      if (!Number.isFinite(numeric)) {
        throw new Error('Length conversion requires a numeric value.');
      }
      return numeric / 3.28084;
    case 'kilograms-to-pounds':
      if (!Number.isFinite(numeric)) {
        throw new Error('Weight conversion requires a numeric value.');
      }
      return numeric * 2.20462;
    case 'pounds-to-kilograms':
      if (!Number.isFinite(numeric)) {
        throw new Error('Weight conversion requires a numeric value.');
      }
      return numeric / 2.20462;
    default:
      throw new Error(`Unsupported conversion: ${conversion}`);
  }
}

function roundNumber(value: number, method: string, decimalPlaces: number): number {
  const places = Math.max(0, Math.trunc(decimalPlaces));
  const factor = 10 ** places;
  const scaled = value * factor;

  let rounded: number;
  switch (method) {
    case 'floor':
      rounded = Math.floor(scaled);
      break;
    case 'ceiling':
      rounded = Math.ceil(scaled);
      break;
    case 'truncate':
      rounded = Math.trunc(scaled);
      break;
    default:
      rounded = Math.round(scaled);
      break;
  }

  return rounded / factor;
}

function applyStringCase(text: string, caseType: string): string {
  switch (caseType) {
    case 'uppercase':
      return text.toUpperCase();
    case 'lowercase':
      return text.toLowerCase();
    case 'title':
      return text
        .toLowerCase()
        .replace(/\b([a-z])/g, (match) => match.toUpperCase());
    case 'sentence': {
      const lower = text.toLowerCase();
      return lower.length === 0 ? lower : `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    }
    default:
      throw new Error(`Unsupported string case: ${caseType}`);
  }
}

export function resolveArrayValue(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  const text = String(value ?? '').trim();
  if (text.length === 0) {
    return [];
  }

  return text.split(',').map((entry) => entry.trim());
}

function resolveArrayInput(value: unknown): string[] {
  return resolveArrayValue(value).map((entry) => String(entry));
}

function cloneArray(array: unknown[]): unknown[] {
  return [...array];
}

function resolveArrayIndex(index: number, length: number): number {
  const normalized = Math.trunc(index);
  if (normalized < 0) {
    return length + normalized;
  }

  return normalized;
}

function sortArray(values: unknown[], method: string): unknown[] {
  const copy = cloneArray(values);

  switch (method) {
    case 'ascending':
      return copy.sort((left, right) => {
        const leftNumber = Number(left);
        const rightNumber = Number(right);
        if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
          return leftNumber - rightNumber;
        }

        return String(left).localeCompare(String(right), undefined, { numeric: true });
      });
    case 'descending':
      return sortArray(copy, 'ascending').reverse();
    case 'alphabetical':
      return copy.sort((left, right) => String(left).localeCompare(String(right)));
    case 'reverse-alphabetical':
      return copy.sort((left, right) => String(right).localeCompare(String(left)));
    default:
      throw new Error(`Unsupported sort method: ${method}`);
  }
}

function createRegex(pattern: string, flags: string): RegExp {
  try {
    return new RegExp(pattern, flags);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid regular expression.';
    throw new Error(message, { cause: error });
  }
}

export async function executeDataComponentHandler(
  handlerId: string,
  node: FlowNode,
  context: FlowExecutionContext,
): Promise<void> {
  const scope: VariableScope = {
    local: context.variables,
    global: context.globalVariableStore.getSnapshot(),
  };
  const fields = createFieldAccessors(node, scope);

  switch (handlerId) {
    case 'data.math': {
      const left = fields.number('leftValue', 'first value');
      const right = fields.number('rightValue', 'second value');
      const operator = fields.string('operator');
      const result = evaluateMath(left, operator, right);
      storeResult(context, scope, fields.string('storeAs'), result);
      break;
    }

    case 'data.random-number': {
      const min = fields.number('minimum', 'minimum');
      const max = fields.number('maximum', 'maximum');
      const count = fields.integer('count', 'count', 1);
      const numbers = Array.from({ length: count }, () => randomInteger(min, max));
      storeResult(context, scope, fields.string('storeAs'), count === 1 ? numbers[0] : numbers);
      break;
    }

    case 'data.random-string': {
      const length = fields.integer('length', 'length', 1);
      const count = fields.integer('count', 'count', 1);
      const charset = buildRandomStringCharset({
        includeNumbers: fields.boolean('includeNumbers'),
        includeUppercase: fields.boolean('includeUppercase'),
        includeLowercase: fields.boolean('includeLowercase'),
        includeSymbols: fields.boolean('includeSymbols'),
      });
      const strings = Array.from({ length: count }, () => generateRandomString(length, charset));
      storeResult(context, scope, fields.string('storeAs'), count === 1 ? strings[0] : strings);
      break;
    }

    case 'data.date-time': {
      const format = fields.string('format') || 'YYYY-MM-DD HH:mm:ss';
      const formatted = formatDateTime(format, new Date());
      storeResult(context, scope, fields.string('storeAs'), formatted);
      break;
    }

    case 'data.convert': {
      const value = fields.value('value');
      const conversion = fields.string('conversion');
      const result = convertValue(value, conversion);
      storeResult(context, scope, fields.string('storeAs'), result);
      break;
    }

    case 'data.round-number': {
      const value = fields.number('value', 'value');
      const method = fields.string('method');
      const decimalPlaces = fields.integer('decimalPlaces', 'decimal places');
      const result = roundNumber(value, method, decimalPlaces);
      storeResult(context, scope, fields.string('storeAs'), result);
      break;
    }

    case 'data.string': {
      const value = fields.string('value');
      storeResult(context, scope, fields.string('storeAs'), value);
      break;
    }

    case 'data.string-length': {
      const text = fields.string('text');
      storeResult(context, scope, fields.string('storeAs'), text.length);
      break;
    }

    case 'data.string-replace': {
      const text = fields.string('text');
      const find = fields.string('find');
      const replace = fields.string('replace');
      const replaceMode = fields.string('replaceMode');
      const result =
        replaceMode === 'first'
          ? text.replace(find, replace)
          : text.split(find).join(replace);
      storeResult(context, scope, fields.string('storeAs'), result);
      break;
    }

    case 'data.string-split': {
      const text = fields.string('text');
      const separator = fields.string('separator');
      const parts = separator.length > 0 ? text.split(separator) : [text];
      storeResult(context, scope, fields.string('storeAs'), parts);
      break;
    }

    case 'data.string-join': {
      const values = resolveArrayInput(fields.value('values'));
      const separator = fields.string('separator');
      storeResult(context, scope, fields.string('storeAs'), values.join(separator));
      break;
    }

    case 'data.string-contains': {
      const text = fields.string('text');
      const search = fields.string('search');
      storeResult(context, scope, fields.string('storeAs'), text.includes(search));
      break;
    }

    case 'data.string-case': {
      const text = fields.string('text');
      const caseType = fields.string('caseType');
      storeResult(context, scope, fields.string('storeAs'), applyStringCase(text, caseType));
      break;
    }

    case 'data.regex-match': {
      const text = fields.string('text');
      const pattern = fields.string('pattern');
      const flags = fields.string('flags');
      const regex = createRegex(pattern, flags);
      storeResult(context, scope, fields.string('storeAs'), regex.test(text));
      break;
    }

    case 'data.regex-replace': {
      const text = fields.string('text');
      const pattern = fields.string('pattern');
      const replacement = fields.string('replacement');
      const flags = fields.string('flags') || 'g';
      const regex = createRegex(pattern, flags);
      storeResult(context, scope, fields.string('storeAs'), text.replace(regex, replacement));
      break;
    }

    case 'data.array': {
      const rawValues = node.config.values;
      const values = Array.isArray(rawValues) ? rawValues : [];
      const resolvedValues = values.map((entry) => resolveConfigValue(entry, scope));
      storeResult(context, scope, fields.string('storeAs'), resolvedValues);
      break;
    }

    case 'data.array-get': {
      const array = resolveArrayValue(fields.value('array'));
      const index = resolveArrayIndex(
        fields.integer('index', 'index'),
        array.length,
      );

      if (index < 0 || index >= array.length) {
        throw new Error(`Array index ${index} is out of bounds.`);
      }

      storeResult(context, scope, fields.string('storeAs'), array[index]);
      break;
    }

    case 'data.array-set': {
      const array = cloneArray(resolveArrayValue(fields.value('array')));
      const index = resolveArrayIndex(
        fields.integer('index', 'index'),
        array.length,
      );

      if (index < 0 || index >= array.length) {
        throw new Error(`Array index ${index} is out of bounds.`);
      }

      array[index] = fields.value('value');
      storeResult(context, scope, fields.string('storeAs'), array);
      break;
    }

    case 'data.array-length': {
      const array = resolveArrayValue(fields.value('array'));
      storeResult(context, scope, fields.string('storeAs'), array.length);
      break;
    }

    case 'data.array-add': {
      const array = cloneArray(resolveArrayValue(fields.value('array')));
      const value = fields.value('value');
      const positionRaw = node.config.position;

      if (
        positionRaw === undefined ||
        positionRaw === null ||
        String(positionRaw).trim().length === 0
      ) {
        array.push(value);
      } else {
        const position = resolveArrayIndex(
          fields.integer('position', 'position'),
          array.length,
        );
        const clampedPosition = Math.max(0, Math.min(position, array.length));
        array.splice(clampedPosition, 0, value);
      }

      storeResult(context, scope, fields.string('storeAs'), array);
      break;
    }

    case 'data.array-remove': {
      const array = cloneArray(resolveArrayValue(fields.value('array')));
      const index = resolveArrayIndex(
        fields.integer('index', 'index'),
        array.length,
      );

      if (index < 0 || index >= array.length) {
        throw new Error(`Array index ${index} is out of bounds.`);
      }

      array.splice(index, 1);
      storeResult(context, scope, fields.string('storeAs'), array);
      break;
    }

    case 'data.array-sort': {
      const array = resolveArrayValue(fields.value('array'));
      const method = fields.string('method');
      storeResult(context, scope, fields.string('storeAs'), sortArray(array, method));
      break;
    }

    case 'data.array-random-item': {
      const array = resolveArrayValue(fields.value('array'));

      if (array.length === 0) {
        throw new Error('Cannot pick a random item from an empty array.');
      }

      const randomIndex = Math.floor(Math.random() * array.length);
      storeResult(context, scope, fields.string('storeAs'), array[randomIndex]);
      break;
    }

    default:
      throw new Error(`Unknown data handler: ${handlerId}`);
  }

  context.logger.info('execution', `Stored result in ${fields.string('storeAs')}`, {
    nodeId: node.id,
    nodeName: node.name,
    details: { handlerId },
  });
}
