import Client from 'ssh2-sftp-client';
import { IOptions } from '../lib';
import { Url } from 'url';
import db from '../db';
import debug from 'debug';

const d = debug('sftp');

export interface SFTP_IFtpResponse {
  type: 'sftp';
  time: number;
  code: number;
  status?: string;
  payload: Buffer;
  fileName?: string;
}

// export interface ConnectOptions {
//   host: string | undefined;
//   port: number | undefined;
//   username: string | undefined;
//   password: string | undefined;
// }

export interface SFTP_IFtpFilePermissions {
  read: boolean;
  write: boolean;
  exec: boolean;
}

export interface SFTP_IFtpFile {
  type: string// file type(-, d, l)
  name: string// file name
  size: number// file size
  modifyTime: number // file timestamp of modified time
  accessTime: number// file timestamp of access time
  rights: {
    user: string
    group: string
    other: string
  },
  owner: string // user ID
  group: string// group ID
}

export class Sftp {
  public _client: Client;

  constructor() {
    this._client = new Client();
  }
  async connect(opts:any){
   return await this._client.connect(opts)
  }
  async list(path: string,regex: string, config: Client.ConnectOptions, watermark?: number): Promise<SFTP_IFtpFile[]> {
    try{
        d("Listing directory [%s]", path);
        d(`with regex : ${regex}`)
        const list = await this._client.connect(config)
        .then(()=>{
          return this._client.list(path, regex) as unknown as SFTP_IFtpFile[]
        })
        await this._client.end
        if (watermark !== undefined) {
          return list
            .sort((a, b) => {
              if (a.modifyTime > b.modifyTime) { return 1; }
              if (b.modifyTime > a.modifyTime) { return -1; }
              return 0;
            })
            .filter((f) => f.modifyTime > watermark);
        }
        return list;
    }catch (err){
      console.log(err)
      throw err
    }
  }

  async get(filepath: string, config: Client.ConnectOptions, readOptions: Client.TransferOptions): Promise<Buffer> {
    d(`get: ${filepath}`);
    const stream = await this._client.connect(config)
    .then(()=> {
      console.log("readOptions "+readOptions)
      return this._client.get(filepath, undefined, readOptions) as unknown as Buffer
    })
    this._client.end
    return stream
  }
}

async function* sftpDownload(url: Url, opts: IOptions): AsyncGenerator<SFTP_IFtpResponse, void, SFTP_IFtpResponse> {
  try {
    if (url.path == null) {
      throw new Error('You must specify a filepath in the url');
    }
    var client = new Sftp()
    const arr = (url.path as string).split("/")
    const path = arr.splice(0, arr.length - 1).join("/")
    const regex = arr.pop() as string
    const watermark = opts.watermark ? await db.getWatermark(url.href) : undefined;
    const config: Client.ConnectOptions={
      host: url.hostname ?? undefined,
      port: url.port ? parseInt(url.port, 10) : undefined,
      username: opts.username,
      password: opts.password,
      readyTimeout: 40000
    }
    let readOption: Client.TransferOptions = {};
    if(!!opts.encoding){
      console.log("Encoding "+opts.encoding)
      readOption = {
        readStreamOptions: {
          encoding: opts.encoding
        }
      }
    }
    const files = await client.list(path, regex, config, watermark)
    client = new Sftp() //car il est préférable de ne pas réutiliser un objet pour plusieurs connexion
    for (const file of files) {
        yield {
          type: 'sftp',
          code: 200,
          time: file.modifyTime,
          status: 'OK',
          payload: await client.get(path +"/"+file.name,config, readOption),
          fileName : file.name,
        };
    }

  } catch (err) {
    d("probleme lors de la recuperation des fichiers du SFTP : " + err)
    throw err;
  }
}

export default sftpDownload;
