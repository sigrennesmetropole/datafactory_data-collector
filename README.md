## http-reaper

Downloads the content of the given URL and queue the payload into a tube based on success or error

### CLI Usage
```
   USAGE:
     http-reaper <url>

   ARGUMENTS:
     <url>                  URL to the resource to download
                              'http(s?):' uses the HTTP connector
                              '(s?)ftp:'  uses the FTP connector

   OPTIONS:
     --auth-pass:           Password used to authenticate the request
     --auth-user:           Username used to authenticate the request
     --csv-columns:         Validates CSV columns types (eg. `Date|int;string;empty|int;bool;float;'open'|'close'`)
     --help:                Shows this help message
     --tube:                Tube to put the message on success
     --watermark:           Whether or not to use a watermark for this resource (default: false)
     -e, --error-tube:      Tube to put the message on failure
     -j, --priority:        Priority of the job, the lower the better (default: 0)
     --csv-delimiter:       CSV delimiter (default: ',')
     --csv-has-header:      CSV contains a header (if --csv-headers is given, this is always true)
     --csv-headers:         Validates that the response body starts with this CSV header
     -d, --delay:           Delay of the job in seconds (default: 0)
     -h, --host:            Beanstalkd host to connect to (default: 'localhost')
     -l, --no-newline:      Disables the automatic newline for output
     -n, --skip-lines:      Skips the 'n' first lines from the response body (default: 0)
     -p, --port:            Beanstalkd port to connect to (default: 11300)
     -r, --ttr:             Time-to-run of the job in seconds (default: 60)
     -t, --timeout:         HTTP GET request timeout in milliseconds (default: 10000)
     -z, --gzip:            Gzip the message before sending it to Beanstalkd (default: false)
```

For `ftp:`, you can specify a glob pattern and `--watermark` in order to download only the latest *not-already-processed* files:
```sh
http-reaper ftp://localhost:21/my-folder/*.csv --watermark --auth-user user --auth-pass pass
```

The first time it executes, it will download all the files that match `/my-folder/*.csv`  
The second time, it will only download the files that are *newer* than the latest processed file (of the first execution).

### Environment variables override
| Env Var | Type | Default Value | Description |
| --- | --- | --- | --- |
| HOST | `string` | `localhost` | Beanstalkd hostname|
| PORT | `string` | `11300` | Beanstalkd port|
| PRIORITY | `number` | `0` | Priority (low value = high priority) |
| DELAY | `number` | `0` | Delay in seconds |
| TTR | `number` | `60` | Timeout in seconds |
| TIMEOUT | `number` | *no timeout* | Connection timeout in milliseconds (only for `http:`) |
| SKIP_LINES | `number` | `0` | Ignore the first `n` lines (infers new line based on the first occurence found in the payload..dumb, but efficient) |
| GZIP | `boolean` | `false` | Compress payload |
| NO_NEWLINE | `boolean` | `false` | Disable automatic EOF end-line |
| CSV_DELIMITER | `string` | `,` | |
| CSV_HEADERS | `string` | | Tries to match the given value with the first line of the payload, if it does not match: **error-tube** |
| CSV_HAS_HEADER | `boolean` | `false` | Whether or not the payload has headers, when `CSV_HEADERS` is `true` this is also `true` |
| CSV_COLUMNS | `string` |  | A tiny DSL that allows us to match the data of each column. [See tests](/src/csv-types/validate.test.ts) |
| AUTH_USER | `string` |  | Only used by `ftp:` |
| AUTH_PASS | `string` | | Only used by `ftp:` |
| WATERMARK | `boolean` | `false` | Only used by `ftp:`.  When set to `true`, the latest downloaded file's timestamp will be stored in a database using the `url` as primary key. |

### Options
```ts
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
}
```
