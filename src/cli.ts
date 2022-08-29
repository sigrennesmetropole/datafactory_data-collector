#!/usr/bin/env node
import arg from 'arg';
import dotenv from 'dotenv';
import { httpReaper, IOptions } from './lib';

function asNumber(value: string | undefined): number | undefined {
  if (!value) {
    return;
  }
  return parseInt(value, 10);
}

function asBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return;
  }
  return value === 'true';
}

function parseArgs(): [string, IOptions] {
  dotenv.config();

  // prettier-ignore
  const args = arg({
    '--help'          : Boolean,
    '--host'          : String,  '-h': '--host',
    '--port'          : Number,  '-p': '--port',
    '--tube'          : String,
    '--priority'      : Number,  '-j': '--priority',
    '--delay'         : Number,  '-d': '--delay',
    '--ttr'           : Number,  '-r': '--ttr',
    '--timeout'       : Number,  '-t': '--timeout',
    '--skip-lines'    : Number,  '-n': '--skip-lines',
    '--gzip'          : Boolean, '-z': '--gzip',
    '--no-newline'    : Boolean, '-l': '--no-newline',
    '--csv-delimiter' : String,
    '--csv-headers'   : String,
    '--csv-has-header': Boolean,
    '--csv-columns'   : String,
    '--auth-user'     : String,
    '--auth-pass'     : String,
    '--watermark'     : Boolean,
    '--encoding'     : String,
  }, {
    permissive: false, // no unknown args
    argv: process.argv.slice(2),
  });

  // prettier-ignore
  if (args['--help'] || !args._[0]) {
    console.log();
    console.log('   USAGE:');
    console.log('     http-reaper <url>');
    console.log();
    console.log('   ARGUMENTS:');
    console.log('     <url>                  URL to the resource to download');
    console.log(`                              'http(s?):' uses the HTTP connector`);
    console.log(`                              '(s?)ftp:'  uses the FTP connector`);
    console.log();
    console.log('   OPTIONS:');
    console.log('     --auth-pass:           Password used to authenticate the request');
    console.log('     --auth-user:           Username used to authenticate the request');
    console.log('     --csv-columns:         Validates CSV columns types (eg. `Date|int;string;empty|int;bool;float;\'open\'|\'close\'`)');
    console.log('     --help:                Shows this help message');
    console.log('     --tube:                Tube to put the message on success');
    console.log('     --watermark:           Whether or not to use a watermark for this resource (default: false)');
    console.log('     -e, --error-tube:      Tube to put the message on failure');
    console.log('     -j, --priority:        Priority of the job, the lower the better (default: 0)');
    console.log(`     --csv-delimiter:       CSV delimiter (default: ',')`);
    console.log(`     --csv-has-header:      CSV contains a header (if --csv-headers is given, this is always true)`);
    console.log(`     --csv-headers:         Validates that the response body starts with this CSV header`);
    console.log(`     -d, --delay:           Delay of the job in seconds (default: 0)`);
    console.log(`     -h, --host:            Beanstalkd host to connect to (default: 'localhost')`);
    console.log(`     -l, --no-newline:      Disables the automatic newline for output`);
    console.log(`     -n, --skip-lines:      Skips the 'n' first lines from the response body (default: 0)`);
    console.log(`     -p, --port:            Beanstalkd port to connect to (default: 11300)`);
    console.log(`     -r, --ttr:             Time-to-run of the job in seconds (default: 60)`);
    console.log(`     -t, --timeout:         HTTP GET request timeout in milliseconds (default: 10000)`);
    console.log(`     -z, --gzip:            Gzip the message before sending it to Beanstalkd (default: false)`);
    console.log(`     --encoding:            read encoding (sftp only)`);
    console.log();
    process.exit(0);
  }

  const tube = args['--tube'] || process.env.TUBE;
  if (!tube) {
    console.log(`Argument '--tube' is mandatory`);
    process.exit(1);
  }

  const host         = args['--host'] || process.env.HOST || 'localhost';
  const port         = args['--port'] ?? asNumber(process.env.PORT) ?? 11300;
  const priority     = args['--priority'] ?? asNumber(process.env.PRIORITY) ?? 0;
  const delay        = args['--delay'] ?? asNumber(process.env.DELAY) ?? 0;
  const ttr          = args['--ttr'] ?? asNumber(process.env.TTR) ?? 60;
  const timeout      = args['--timeout'] ?? asNumber(process.env.TIMEOUT) ?? 10000;
  const skipLines    = args['--skip-lines'] ?? asNumber(process.env.SKIP_LINES) ?? 0;
  const gzip         = args['--gzip'] ?? asBoolean(process.env.GZIP) ?? false;
  const noNewLine    = args['--no-newline'] ?? asBoolean(process.env.NO_NEWLINE) ?? false;
  const csvDelimiter = args['--csv-delimiter'] || process.env.CSV_DELIMITER;
  const csvHeaders   = args['--csv-headers'] || process.env.CSV_HEADERS;
  const csvHasHeader = args['--csv-has-header'] ?? asBoolean(process.env.CSV_HAS_HEADER);
  const csvColumns   = args['--csv-columns'] || process.env.CSV_COLUMNS;
  const username     = args['--auth-user'] || process.env.AUTH_USER;
  const password     = args['--auth-pass'] || process.env.AUTH_PASS;
  const watermark    = args['--watermark'] ?? asBoolean(process.env.WATERMARK) ?? false;
  const encoding     = args['--encoding'] || process.env.ENCODING; 

  return [
    args._[0],
    {
      host,
      port,
      tube,
      priority,
      delay,
      ttr,
      timeout,
      skipLines,
      gzip,
      newLine: !noNewLine,
      csvDelimiter,
      csvHeaders,
      csvHasHeader,
      csvColumns,
      username,
      password,
      watermark,
      encoding
    },
  ];
}

async function main() {
  const [url, options] = parseArgs();
  const code = await httpReaper(url, options);
  console.log("Success")
  process.exit(code);
}

main().catch((err) => {
  if (err instanceof Error) {
    console.error(err.message);
  } else {
    console.error(err);
  }
  process.exit(1);
});
