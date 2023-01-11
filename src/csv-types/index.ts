import { parse as pegParser } from './grammar';
import {
  CsvError,
  CsvDateError,
  CsvBoolError,
  CsvEmptyError,
  CsvFloatError,
  CsvIntError,
  CsvStringError,
  CsvConstantError,
  CsvColMismatchError,
} from './errors';

export * from './errors';

const FLOAT_REGEX = /^(-)?[\d]*[.,][\d]+$/;
const INT_REGEX = /^(-)?[\d]+$/;

export type CsvType =
  | CsvDate
  | CsvString
  | CsvInt
  | CsvFloat
  | CsvBool
  | CsvEmpty
  | CsvConstant
  | CsvUnion;

export interface CsvDate {
  type: 'Date';
}

export interface CsvString {
  type: 'string';
}

export interface CsvInt {
  type: 'int';
}

export interface CsvFloat {
  type: 'float';
}

export interface CsvBool {
  type: 'bool';
}

export interface CsvEmpty {
  type: 'empty';
}

export interface CsvConstant {
  type: 'constant';
  value: string;
}

export type CsvUnion = {
  type: 'union';
  values: CsvType[];
};

function isFloat(value: string): boolean {
  return FLOAT_REGEX.exec(value) !== null;
}

function isInt(value: string): boolean {
  if (INT_REGEX.exec(value) !== null) {
    const res = parseInt(value, 10);
    if (isNaN(res) || isFloat(value)) {
      return false;
    }
    return true;
  }
  return false;
}

function validateCol(
  [row, col]: [number, number],
  value: string,
  type: CsvType
): CsvError[] {
  if (type == undefined) {
    return []
  }
  switch (type.type) {
    case 'Date': {
      const res = Date.parse(value);
      if (isNaN(res)) {
        return [new CsvDateError(col, row, value)];
      }
      break;
    }

    case 'bool':
      if (value === 'true' || value === 'false') {
        break;
      }
      return [new CsvBoolError(col, row, value)];

    case 'empty':
      if (value.length > 0) {
        return [new CsvEmptyError(col, row)];
      }
      break;

    case 'float':
      if (!isFloat(value)) {
        return [new CsvFloatError(col, row, value)];
      }
      break;

    case 'int': {
      if (!isInt(value)) {
        return [new CsvIntError(col, row, value)];
      }
      break;
    }

    case 'string': {
      if (value.length === 0) {
        return [new CsvStringError(col, row, value)];
      }
      break;
    }

    case 'constant': {
      if (value !== type.value) {
        return [new CsvConstantError(type.value, col, row, value)];
      }
      break;
    }

    case 'union': {
      const errors: CsvError[] = [];
      for (const t of type.values) {
        const uErrors = validateCol([row, col], value, t);
        if (uErrors.length === 0) {
          return [];
        } else {
          errors.push(...uErrors);
        }
      }
      return [errors[0]];
    }
  }
  return [];
}

/**
 * Parses CSV types on a column based system
 *
 * @param {string} value eg. `Date|int;string;empty|int;bool;float;'open'|'close'`
 * @returns {CsvType[]}
 */
export function parse(source: string): CsvType[] {
  return pegParser(source) as CsvType[];
}

/**
 *
 * @param {number} rowIdx
 * @param {string[]} cols a CSV row to validate against the given types
 * @param {CsvType[]} types a list of types to be matched with the row's columns
 * @returns {CsvError[]} a list of errors; if the list is empty then the row is valid
 */
export function validate(
  rowIdx: number,
  cols: string[],
  types: CsvType[]
): CsvError[] {
  if (cols.length < types.length) {
    return [new CsvColMismatchError(rowIdx, cols.length, types.length)];
  }
  return cols.reduce((errors, value, colIdx) => {
    return errors.concat(validateCol([rowIdx, colIdx], value, types[colIdx]));
  }, [] as CsvError[]);
}
