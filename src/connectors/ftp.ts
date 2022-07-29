import JsFTP, { JsftpOpts } from 'jsftp';
import { Readable } from 'stream';
import mm from 'micromatch';
import { IOptions } from '../lib';
import { Url } from 'url';
import db from '../db';
import debug from 'debug';

const d = debug('ftp');

export interface IFtpResponse {
  type: 'ftp';
  time: number;
  code: number;
  status?: string;
  payload: Buffer;
  fileName?: string;
}

export interface IFtpFilePermissions {
  read: boolean;
  write: boolean;
  exec: boolean;
}

export interface IFtpFile {
  name: string;
  time: number;
  size: string;
  owner: string;
  group: string;
  userPermissions: IFtpFilePermissions;
  groupPermissions: IFtpFilePermissions;
  otherPermissions: IFtpFilePermissions;
}

export class Ftp {
  private _client: JsFTP;

  constructor(opts: JsftpOpts) {
    this._client = new JsFTP(opts);
  }

  async list(dirpath: string, watermark?: number): Promise<IFtpFile[]> {
    d("Listing directory [%s]", dirpath);
    const list = await new Promise<IFtpFile[]>((r, e) => {
      this._client.ls(dirpath, (err, list) => err ? e(err) : r(list as unknown as IFtpFile[]));
    });
    if (watermark !== undefined) {
      return list
        .sort((a, b) => {
          if (a.time > b.time) { return 1; }
          if (b.time > a.time) { return -1; }
          return 0;
        })
        .filter((f) => f.time > watermark);
    }

    return list;
  }

  async get(filepath: string): Promise<Buffer> {
    const stream = await this.getReadStream(filepath);
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  getReadStream(filepath: string): Promise<Readable> {
    return new Promise((r, e) => {
      this._client.get(filepath, (err, socket) => {
        if (err) {
          e(err);
        } else {
          socket.resume();
          r(socket);
        }
      });
    });
  }

  quit(): Promise<void> {
    return new Promise((r, e) => this._client.raw('quit', (err) => err ? e(err) : r()));
  }
}

function clean(url: string, pattern: string): string {
  if (url.length === 0) {
    throw new Error(`Empty ftp file url matching '${pattern}'`);
  }
  if (url[0] === '/') {
    return url.slice(1);
  }
  return url;
}

async function* ftpDownload(url: Url, opts: IOptions): AsyncGenerator<IFtpResponse, void, IFtpResponse> {
  const client = new Ftp({
    host: url.hostname ?? undefined,
    port: url.port ? parseInt(url.port, 10) : undefined,
    user: opts.username,
    pass: opts.password,
  });

  try {
    if (url.path == null) {
      throw new Error('You must specify a filepath in the url');
    }

    const matcher = mm.matcher(url.path);
    const watermark = opts.watermark ? await db.getWatermark(url.href) : undefined;
    const files = await client.list(url.path, watermark);

    for (const file of files) {
      if (matcher(file.name)) {
        yield {
          type: 'ftp',
          code: 200,
          time: file.time,
          status: 'OK',
          payload: await client.get(clean(file.name, url.path)),
          fileName: file.name,
        };
      }
    }
    await client.quit();
  } catch (err) {
    await client.quit();
    throw err;
  }
}

export default ftpDownload;
