import zlib from 'zlib';
import { promisify } from 'util';
import { ISecuredOptions } from './lib';
const gzip = promisify<Buffer, Buffer>(zlib.gzip);

/**
 * Strips the first 'n' lines from source
 *
 * @param payload
 * @param n number of lines to delete from source
 */
export function stripLines(payload: Buffer, n: number): Buffer {
  if (n <= 0) {
    return payload;
  }
  const source = payload.toString();
  let cursor = 0;
  let nbLines = 0;
  while (cursor < source.length && nbLines < n) {
    const lfCursor = source.indexOf('\n', cursor);
    if (lfCursor == -1) {
      cursor = source.length;
      return Buffer.from(source.substring(cursor));
    }
    nbLines++;
    cursor = lfCursor + 1;
  }
  return Buffer.from(source.substring(cursor));
}

export function guessLfChar(value: Buffer): '\r\n' | '\n' {
  // FIXME this is a pretty stupid guess but who cares
  return value.indexOf('\r\n') === -1 ? '\n' : '\r\n';
}

export function endsWith(b: Buffer, s: string): boolean {
  if (s.length === 0) {
    return true;
  }
  const begin = b.length - s.length;
  const end = begin + s.length;
  if (b.slice(begin, end).toString() === s) {
    return true;
  }
  return false;
}

export function newLine(payload: Buffer): Buffer {
  const lf = guessLfChar(payload);
  if (!endsWith(payload, lf)) {
    return Buffer.concat([payload, Buffer.from(lf)]);
  }
  return payload;
}

export default async function transform(payload: Buffer, opts: ISecuredOptions): Promise<Buffer> {
  if (opts.skipLines > 0) {
    payload = stripLines(payload, opts.skipLines);
  }
  if (opts.newLine) {
    payload = newLine(payload);
  }
  if(!!opts.datePhoto && !!opts.csvDelimiter && !!opts.csvHasHeader && opts.tube!='idea_exutoire_latest'){
    payload = addDatePhoto(payload, opts.datePhoto, opts.csvDelimiter, opts.csvHasHeader);
  }

  return opts.gzip ? await gzip(payload) : payload;
}

function addDatePhoto(payload: Buffer, datePhoto: string, csvDelimiter: string, csvHasHeader: boolean): Buffer {
  payload = Buffer.from(payload.toString().replace( new RegExp(guessLfChar(payload), "g"), csvDelimiter+"\""+datePhoto+"\""+guessLfChar(payload)));
  // to remplace in header
  if(csvHasHeader){
    payload = Buffer.from(payload.toString().replace( "\""+datePhoto+"\"", "\"date_photo\""));
  }
  return payload;
}
