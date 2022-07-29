import { parse, Url } from 'url';
import { IOptions } from '../lib';
import http, { IHttpResponse } from './http';
import ftp, { IFtpResponse } from './ftp';
import sftp, { SFTP_IFtpResponse } from './sftp';
import debug from 'debug';

export type IResponse = IHttpResponse | IFtpResponse | SFTP_IFtpResponse;
export type IConnector = (url: Url, opts: IOptions) => AsyncGenerator<IResponse, void, IResponse>;

export function download(url: string, opts: IOptions): AsyncGenerator<IResponse> {
  
  const d = debug('reaper');
  const uri = parse(url);
  switch (uri.protocol) {
    // FTP connector
    case 'ftp:': d(`call ftp`); return ftp(uri, opts);
    case 'sftp:': d(`call sftp`); return sftp(uri, opts);
    // HTTP connector
    case 'http:':
    case 'https:': return http(uri, opts);
    // unknown connector
    default:
      throw new Error(`Protocol '${uri.protocol ?? 'null'}' is not supported`);
  }
}