import * as csv from '@fast-csv/parse';
import {
  parse as csvTypesParse,
  validate as csvTypesValidate,
} from './csv-types';
import { IErrorMsg, ISecuredOptions } from './lib';
import { PassThrough } from 'stream';
import { CsvError } from './csv-types/errors';
import { IResponse } from './connectors';

function httpValidator(code: number): boolean {
  return code >= 200 && code < 400;
}

function csvHeadersValidator(payload: string, headers: string): boolean {
  return payload.startsWith(headers);
}

async function csvColumnsValidator(
  payload: Buffer,
  csvColumns: string,
  delimiter = ',',
  hasHeaders = true
): Promise<CsvError[]> {
  return new Promise<CsvError[]>((resolve, reject) => {
    let index = hasHeaders ? 1 : 0;
    const types = csvTypesParse(csvColumns);
    const stream = new PassThrough();
    stream.end(payload);
    stream
      .pipe(
        csv.parse({
          headers: false, // we want rows to be arrays not object
          skipLines: hasHeaders ? 1 : 0, // skip header if present because we validate rows, not headers
          delimiter,
        })
      )
      .on('data', (row) => {
        const errors = csvTypesValidate(index, row, types);
        if (errors.length > 0) {
          throw errors;
        }
        index++;
      })
      .on('end', () => resolve([]))
      .on('error', (err) => {
        if (err instanceof Array) {
          resolve(err);
        } else {
          reject(err);
        }
      });
  });
}

export default async function validate(
  url: string,
  res: IResponse,
  opts: ISecuredOptions
): Promise<IErrorMsg | undefined> {
  const defaultMsg: IErrorMsg = {
    url: url,
    time: Date.now(),
    options: opts,
    statusCode: res.code,
    statusText: res.status,
    payload: res.payload.toString(),
  };
  if (!httpValidator(res.code)) {
    return defaultMsg;
  }

  if (opts.csvHeaders) {
    if (!csvHeadersValidator(res.payload.toString(), opts.csvHeaders)) {
      return {
        ...defaultMsg,
        errors: [`mismatched csv headers (expected: ${opts.csvHeaders})`],
      };
    }
  }

  if (opts.csvColumns) {
    let hasHeader = opts.csvHasHeader ?? true;
    if (opts.csvHeaders) {
      hasHeader = true;
    }
    const errors = await csvColumnsValidator(
      res.payload,
      opts.csvColumns,
      opts.csvDelimiter,
      hasHeader
    );
    if (errors.length > 0) {
      return {
        ...defaultMsg,
        errors,
      };
    }
  }

  return;
}
