import { BeanstalkClient } from '@beanstalk/core';
import validator from './validator';
import transform from './transform';
import { CsvError } from './csv-types/errors';
import * as connector from './connectors';
import db from './db';
import debug from 'debug';

const d = debug('reaper');

export interface ISensitiveOptions {
  /**
   * A password used by the FTP driver
   */
  password?: string;
}

export interface IOptions extends ISensitiveOptions {
  /** Beanstalkd host */
  host: string;
  /** Beanstalkd port */
  port: number;
  /** when download succeeds: send to this tube */
  tube: string;
  /** Priority of the job, the lower the better */
  priority: number;
  /** Delay of the job in seconds */
  delay: number;
  /** Time-to-run of the job in seconds */
  ttr: number;
  /** HTTP GET request timeout in milliseconds */
  timeout: number;
  /** Skips 'n' first lines of the response body (eg. for `.csv` file to remove header: `{ skipLines: 1 }`) */
  skipLines: number;
  /** Gzip the message before sending it to Beanstalkd */
  gzip: boolean;
  /** If true, adds a trailing newline to the output (if needed) */
  newLine: boolean;
  /** CSV delimiter */
  csvDelimiter?: string;
  /**
   * Verify that the response body is a CSV with these headers
   *
   * eg. `datetime;predefinedLocationReference;averageVehicleSpeed;travelTime;travelTimeReliability;trafficStatus`
   */
  csvHeaders?: string;
  /**
   * Verify that the response body is a CSV with these column types
   *
   * eg. `Date;string|int;int;bool;float;empty|int;'freeFlow'|'congested'|'impossible'`
   *
   * The different types are:
   *  - `Date` = what is parsed by EcmaScript 'Date'
   *  - `string` = any string
   *  - `int` = an integer
   *  - `float` = a floating point number
   *  - `bool` = true | false
   *  - `'<string>'` = a specific string, eg. 'my-string'
   *  - `empty` = an empty column
   *
   * Also, you can specify union types using a pipe `|`:
   *  - `Date|string`
   *  - `int|empty`
   *  - `'open'|'close'|bool`
   */
  csvColumns?: string;
  /**
   * Specify if the response body has a CSV header.
   * If `csvHeaders` is given, this is `true` no matter what.
   */
  csvHasHeader?: boolean;
  /**
   * A username used by the FTP driver
   */
  username?: string;
  /**
   * Whether or not to use a watermark for this resource.
   *
   * **This is relevant only for `ftp`** *(for now)*
   *
   * **When this is `true` you have to have a `redis` database
   * up and running in order for http-reaper to connect to it**.
   *
   * *The connection information will be used from env vars*
   *   `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_PREFIX` (to prefix all keys, defaults to 'reaper')
   *
   * When this is set to `true` the last downloaded resource's timestamp will be saved
   * into the database and the next download will discard all resources that are older
   * than this saved watermark.
   */
  watermark?: boolean;

  encoding?: string;

  datePhoto?: string;

}

export interface IErrorMsg {
  url: string;
  time: number;
  options: IOptions;
  payload?: string;
  statusCode?: number;
  statusText?: string;
  errors?: Array<Error | CsvError | string>;
}

export interface ISecuredOptions extends IOptions {
  password: undefined;
}

export function secured(opts: IOptions): ISecuredOptions {
  const o: ISecuredOptions = {
    ...opts,
    password: undefined,
  };
  return o;
}

function printError(
  url: string,
  err: Error | string,
  options: ISecuredOptions
) {
  const msg: IErrorMsg = {
    url,
    time: Date.now(),
    options,
    errors: [typeof err === 'string' ? err : err.message],
  };
  d(`error ${url} (${typeof err === 'string' ? err : err.message})`);
  console.error(JSON.stringify(msg));
}

async function* download(
  url: string,
  opts: IOptions
): AsyncGenerator<[connector.IResponse, Buffer]> {
  const options = secured(opts);
  d(`download: ${url}`);
  const responses = connector.download(url, opts);
  for await (const res of responses) {
    d(`process ${url}`);
    const error = await validator(url, res, options);
    if (error) {
      throw error;
    }
    if(opts.tube == "traffic_latest"){
      await logForTraffic(res, url);
    }
    if(opts.tube == "terberg_latest"){
    }
    if(opts.tube == "idea_latest"){
      await logForIdea(res, url);
    }
    if(opts.tube == "idea_prod_latest"){
      if(!!res.fileName){
        var myRegexp = new RegExp("(?:^|\s|\/)tbl_Producteurs_(.*?)\.(txt|csv)", "g");
        var match = myRegexp.exec(res.fileName);
        if(!!match){
          options.datePhoto = match[1];
        }
      }
      if(!options.datePhoto){
        d("Le format du nom de fichier ne correspond pas à l'attendu.")
        continue;
      } else {
        d("Le format du nom de fichier correspond "+ options.datePhoto)
      }
      await logForIdeaProducer(res, url);
    }
    if(opts.tube == "idea_recip_latest"){
      if(!!res.fileName){
        var myRegexp = new RegExp("(?:^|\s|\/)tbl_Récipients_pucés_(.*?)\.(txt|csv)", "g");
        var match = myRegexp.exec(res.fileName);
        if(!!match){
          options.datePhoto = match[1];
        }
      }
      if(!options.datePhoto){
        d("Le format du nom de fichier ne correspond pas à l'attendu.")
        continue;
      } else {
        d("Le format du nom de fichier correspond "+ options.datePhoto)
      }
      await logForIdeaRecipient(res, url);
    }
    if(opts.tube == "idea_exutoire_latest"){
      if(!!res.fileName){
        var myRegexp = new RegExp("(?:^|\s|\/)EXUTOIRES_(.*?)\.(txt|csv)", "g");
        var match = myRegexp.exec(res.fileName);
        if(!!match){
          options.datePhoto = match[1];
        }
      }
      if(!options.datePhoto){
        d("Le format du nom de fichier ne correspond pas à l'attendu.")
        continue;
      } else {
        d("Le format du nom de fichier correspond "+ options.datePhoto)
      }
      await logForIdeaExutoire(res, url);
    }
    if (opts.tube == "air_latest") {
      if (!!res.fileName) {
        var myRegexp = new RegExp("(?:^|\s|\/)test_air_(.*?)\.(txt|csv)", "g");
        var match = myRegexp.exec(res.fileName);
      }
      d("Le format du nom de fichier correspond " + options.datePhoto)
      await logForQAir(res, url);
    }
    const payload = await transform(res.payload, options);
    yield [res, payload];
  }
}

/**
 * @param url 
 * @param opts
 * @returns 0 on success; 1 on error 
 */
async function httpReaper(url: string, opts: IOptions): Promise<number> {
  const client = new BeanstalkClient();
  await client.connect(opts.host, opts.port);
  try {
    //ii
    for await (const msg of download(url, opts)) {
      const [res, payload] = msg;
      await client.use(opts.tube);
      await transactional_put(
        url,
        res.type,
        res.time,
        opts,
        client,
        payload
      );
    }
  } catch (err) {
    if (err instanceof Error || typeof err === 'string') {
      printError(url, err, secured(opts));
    } else {
      // IErrorMsg already
      console.error(err);
    }
    await client.quit();
    await db.disconnect();
    return 1;
  } finally {
    await client.quit();
    await db.disconnect();
  }
  return 0;
}

/**
 * Ensures that if `put` fails, it will rollback the watermark to the previous state
 * @param url
 * @param res
 * @param opts
 * @param client
 * @param payload
 */
async function transactional_put(
  url: string,
  resType: connector.IResponse['type'],
  resTime: connector.IResponse['time'],
  opts: IOptions,
  client: BeanstalkClient,
  payload: Buffer
): Promise<void> {
  await client.put(payload, {
    priority: opts.priority,
    delay: opts.delay,
    ttr: opts.ttr,
  });
  d(`put ${url}`);
  if (resType === 'ftp') {
    // update watermark only for 'ftp' for now
    await db.updateWatermark(url, resTime);
    d(`watermark ${resTime}`);
  }
  if (resType === 'sftp') {
    // update watermark only for 'sftp' for now
    await db.updateWatermark(url, resTime);
    d(`watermark ${resTime}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stdout(o: any) {
  process.stdout.write(`${JSON.stringify(o)}\n`);
}

async function logForTraffic(res: connector.IResponse, url: String) {
  var datas = res.payload.toString().replace(/(\r)/gm,"").split("\n");
    var rowsNumber =  datas.length -1; 

  stdout({ progress: 0.5, description: `${rowsNumber} rows downloaded from ${url}.` });
    type ITableRow = [string, string, number, number, number, string];
    const rows: ITableRow[] = [];
    for await (const row of datas.slice(1,10)) {
      var rowFormated = row.split(";");
      rows.push([
        rowFormated[0],
        rowFormated[1],
        Number(rowFormated[2]),
        Number(rowFormated[3]),
        Number(rowFormated[4]),
        rowFormated[5]
      ]);
    };
    stdout({
      table: {
        title: 'Aperçu des données collectées',
        header: [
          'Datetime',
          'Predefined location reference',
          'Average vehicle speed',
          'Travel time',
          'Travel time reliability',
          'Traffic status'
        ],
        rows,
      },
    });
}

async function logForIdea(res: connector.IResponse, url: string) {
  var datas = res.payload.toString().replace(/(\r)/gm,"").split("\n");
    var rowsNumber =  datas.length -1;
  stdout({ progress: 0.5, description: `${rowsNumber} rows downloaded from ${url}.` });
    type ITableRow = [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string];
    const rows: ITableRow[] = [];
    for await (const row of datas.slice(1,10)) {
      var rowFormated = row.split(";");
      rows.push([
        rowFormated[0],
        rowFormated[1],
        rowFormated[2],
        rowFormated[3],
        rowFormated[4],
        rowFormated[5],
        rowFormated[6],
        rowFormated[7],
        rowFormated[8],
        rowFormated[9],
        rowFormated[10],
        rowFormated[11],
        rowFormated[12],
        rowFormated[13],
        rowFormated[14]
      ]);
    };
    stdout({
      table: {
        title: 'Aperçu des données collectées',
        header: [
          'Date de la levée',
          'Heure de la levée',
          'Code puce',
          'Pesée net',
          'Statut de la levée',
          'Latitude',
          'Longitude',
          'Bouton poussoir 1',
          'Bouton poussoir 2',
          'Bouton poussoir 3',
          'Bouton poussoir 4',
          'Bouton poussoir 5',
          'Bouton poussoir 6',
          'Statut bac',
          'Tournée',
          'Immatriculation'
        ],
        rows,
      },
    });
}

async function logForIdeaProducer(res: connector.IResponse, url: string) {
  var datas = res.payload.toString().replace(/(\r)/gm,"").split("\n");
    var rowsNumber =  datas.length -1;
  stdout({ progress: 0.5, description: `${rowsNumber} rows downloaded from ${url}.` });
    type ITableRow = [string, string, string, string, string, string, string, string];
    const rows: ITableRow[] = [];
    for await (const row of datas.slice(1,10)) {
      var rowFormated = row.split(";");
      rows.push([
        rowFormated[0],
        rowFormated[1],
        rowFormated[2],
        rowFormated[3],
        rowFormated[4],
        rowFormated[5],
        rowFormated[6],
        rowFormated[7]
      ]);
    };
    stdout({
      table: {
        title: 'Aperçu des données référentielles producteurs collectées',
        header: [
          'code_producteur',
          'rva_ida',
          'code_insee',
          'nom_commune',
          'type_producteur',
          'activite',
          'longitude',
          'latitude'
        ],
        rows,
      },
    });
}

async function logForIdeaRecipient(res: connector.IResponse, url: string) {
  var datas = res.payload.toString().replace(/(\r)/gm,"").split("\n");
    var rowsNumber =  datas.length -1;
  stdout({ progress: 0.5, description: `${rowsNumber} rows downloaded from ${url}.` });
    type ITableRow = [string, string, string, string, string, string, string];
    const rows: ITableRow[] = [];
    for await (const row of datas.slice(1,10)) {
      var rowFormated = row.split(";");
      rows.push([
        rowFormated[0],
        rowFormated[1],
        rowFormated[2],
        rowFormated[3],
        rowFormated[4],
        rowFormated[5],
        rowFormated[6]
      ]);
    };
    stdout({
      table: {
        title: 'Aperçu des données référentielles récipîents pucés collectées',
        header: [ 
          'code_producteur',
          'categorie_recipient',
          'type_recipient',
          'litrage_recipient',
          'code_puce',
          'frequence_om',
          'frequence_cs'
        ],
        rows,
      },
    });
}
async function logForIdeaExutoire(res: connector.IResponse, url: string) {
  var datas = res.payload.toString().replace(/(\r)/gm,"").split("\n");
    var rowsNumber =  datas.length -1;
  stdout({ progress: 0.5, description: `${rowsNumber} rows downloaded from ${url}.` });
    type ITableRow = [string, string, string, string, string, string, string, string, string, string];
    const rows: ITableRow[] = [];
    for await (const row of datas.slice(1,10)) {
      var rowFormated = row.split(";");
      rows.push([
        rowFormated[0],
        rowFormated[1],
        rowFormated[2],
        rowFormated[3],
        rowFormated[4],
        rowFormated[5],
        rowFormated[6],
        rowFormated[7],
        rowFormated[8],
        rowFormated[9]
      ]);
    };
    stdout({
      table: {
        title: 'Aperçu des données exutoires collectées',
        header: [ 
          'immat',
          'date_Service_Vehic',
          'code_Tournee',
          'km_Realise',
          'no_Bon',
          'lot',
          'service',
          'nom_Rech_Lieu_De_Vidage',
          'multiples_Lignes',
          'cle_Unique_Ligne_Ticket'
        ],
        rows,
      },
    });
  }
async function logForQAir(res: connector.IResponse, url: string) {
  var datas = res.payload.toString().replace(/(\r)/gm, "").split("\n");
  var rowsNumber = datas.length - 1;
  stdout({ progress:0.5, description: `${rowsNumber} rows downloaded froms ${url}.` });
  type ITableRow = [string, string, string, string, string, string, string];
  const rows: ITableRow[] = [];
  for await (const row of datas.slice(1, 10)) {
    var rowFormated = row.split(";");
    rows.push([
      rowFormated[0],
      rowFormated[1],
      rowFormated[2],
      rowFormated[3],
      rowFormated[4],
      rowFormated[5],
      rowFormated[6]
    ]);
  };
  stdout({
    table: {
      title: "Aperçu des données qualité de l'air collectées",
      header: [
        'numins',
        'identifier',
        'ref_externe_1',
        'libelle_propriete',
        'date_heure',
        'valeur',
        'unite'
      ],
      rows,
    },
  });
}

// 'download' is exported for test-purposes only
export { download, httpReaper };
