export class CsvError extends Error {
  constructor(message: string, readonly col = 0, readonly row = 0, readonly value?: string) {
    super(`[${row}:${col}] ${message}${value ? ` [value=${value}]` : ''}`);
  }

  toJSON(): Record<string, string | number | undefined> {
    return {
      message: this.message,
      col: this.col,
      row: this.row,
      value: this.value,
    };
  }
}

export class CsvColMismatchError extends CsvError {
  constructor(rowIdx: number, colsLen: number, typesLen: number) {
    super(`column number mismatch (actual: ${colsLen}, expected: ${typesLen})`, colsLen, rowIdx);
  }
}

export class CsvDateError extends CsvError {
  constructor(col: number, row?: number, value?: string) {
    super('invalid date', col, row, value);
  }
}

export class CsvIntError extends CsvError {
  constructor(col: number, row?: number, value?: string) {
    super('invalid int', col, row, value);
  }
}

export class CsvFloatError extends CsvError {
  constructor(col: number, row?: number, value?: string) {
    super('invalid float', col, row, value);
  }
}

export class CsvBoolError extends CsvError {
  constructor(col: number, row?: number, value?: string) {
    super('invalid bool', col, row, value);
  }
}

export class CsvStringError extends CsvError {
  constructor(col: number, row?: number, value?: string) {
    super('invalid string', col, row, value);
  }
}

export class CsvConstantError extends CsvError {
  constructor(
    readonly expected: string,
    col: number,
    row?: number,
    value?: string,
  ) {
    super(`invalid constant [expected=${expected}]`, col, row, value);
  }
}

export class CsvEmptyError extends CsvError {
  constructor(col: number, row?: number, value?: string) {
    super('column is not empty', col, row, value);
  }
}
