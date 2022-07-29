/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { expect } from 'chai';
import zlib from 'zlib';
import nock from 'nock';
import { download, secured, IOptions } from './lib';
import fs from 'fs';
import path from 'path';
import { CsvFloatError } from './csv-types/errors';
import { IResponse } from './connectors';

/**
 * Default options for test purposes
 */
const defaultOptions: IOptions = {
  host: '',
  port: 11300,
  delay: 0,
  priority: 0,
  skipLines: 0,
  gzip: false,
  tube: 'success',
  timeout: 2000,
  ttr: 10,
  newLine: true,
};

describe('lib', () => {
  describe('http', () => {
    it('default', async () => {
      const url = 'http://example.com/my-resource.csv';
      const opts: IOptions = defaultOptions;

      // mock
      const resource = 'id;name\n0;John\n1;Paula\n';
      nock('http://example.com').get('/my-resource.csv').reply(200, resource);

      const [, payload]: [IResponse, Buffer] = (
        await download(url, opts).next()
      ).value;
      expect(payload).to.eql(Buffer.from(resource));
    });

    it('gzip', async () => {
      const url = 'http://example.com/my-resource.csv';
      const opts: IOptions = { ...defaultOptions, gzip: true };

      // mock
      const resource = 'id;name\n0;John\n1;Paula\n';
      nock('http://example.com').get('/my-resource.csv').reply(200, resource);

      const [, payload]: [IResponse, Buffer] = (
        await download(url, opts).next()
      ).value;
      expect(payload).to.eql(zlib.gzipSync(resource));
    });

    it('with newline (LF)', async () => {
      const url = 'http://example.com/my-resource.csv';
      const opts: IOptions = defaultOptions;

      // mock
      const resource = 'id;name\n0;John\n1;Paula';
      nock('http://example.com').get('/my-resource.csv').reply(200, resource);

      const [, payload]: [IResponse, Buffer] = (
        await download(url, opts).next()
      ).value;
      expect(payload).to.eql(Buffer.from(resource + '\n'));
    });

    it('with newline (CRLF)', async () => {
      const url = 'http://example.com/my-resource.csv';
      const opts: IOptions = defaultOptions;

      // mock
      const resource = 'id;name\r\n0;John\r\n1;Paula';
      nock('http://example.com').get('/my-resource.csv').reply(200, resource);

      const [, payload]: [IResponse, Buffer] = (
        await download(url, opts).next()
      ).value;
      expect(payload).to.eql(Buffer.from(resource + '\r\n'));
    });

    it('no newline', async () => {
      const url = 'http://example.com/my-resource.csv';
      const opts: IOptions = { ...defaultOptions, newLine: false };

      // mock
      const resource = 'id;name\r\n0;John\r\n1;Paula';
      nock('http://example.com').get('/my-resource.csv').reply(200, resource);

      const [, payload]: [IResponse, Buffer] = (
        await download(url, opts).next()
      ).value;
      expect(payload).to.eql(Buffer.from(resource));
    });

    it('csvColumns', async () => {
      const url = 'http://example.com/my-resource.csv';
      const opts: IOptions = {
        ...defaultOptions,
        csvColumns: 'int;string',
        csvDelimiter: ';',
      };

      // mock
      const resource = 'id;name\r\n0;John\r\n1;Paula';
      nock('http://example.com').get('/my-resource.csv').reply(200, resource);

      const [, payload]: [IResponse, Buffer] = (
        await download(url, opts).next()
      ).value;
      expect(payload.toString()).to.eql(resource + '\r\n');
    });

    it('empty payload', async () => {
      const url = 'http://example.com/my-resource.csv';
      const opts: IOptions = {
        ...defaultOptions,
        csvHeaders: 'id;name',
        csvColumns: 'int;string',
        csvDelimiter: ';',
      };

      // mock
      nock('http://example.com').get('/my-resource.csv').reply(200, '');

      try {
        await download(url, opts).next();
        throw new Error('This was supposed to throw');
      } catch (err) {
        expect(err.url).to.equal(url);
        expect(err.options).to.eql(secured(opts));
        expect(err.payload).to.equal('');
        expect(err.statusCode).to.equal(200);
        expect(err.statusText).to.equal('OK');
        const errors = err.errors as [string];
        expect(errors[0]).to.eql('mismatched csv headers (expected: id;name)');
      }
    });

    it('wrong csvColumns', async () => {
      const url = 'http://example.com/my-resource.csv';
      const opts: IOptions = { ...defaultOptions, csvColumns: 'int;float' };

      // mock
      const resource = 'id,name\r\n0,3.14\r\n1,false';
      nock('http://example.com').get('/my-resource.csv').reply(200, resource);

      try {
        await download(url, opts).next();
        throw new Error('This was supposed to throw');
      } catch (error) {
        expect(error.url).to.equal(url);
        expect(error.statusCode).to.equal(200);
        expect(error.statusText).to.equal('OK');
        expect(error.payload).to.equal(resource);
        expect(error.options).to.eql(secured(opts));
        expect(error.errors?.length).to.equal(1);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const err = error.errors![0] as CsvFloatError;
        expect(err.message).to.eql('[2:1] invalid float [value=false]');
        expect(err.row).to.eql(2);
        expect(err.col).to.eql(1);
        expect(err.value).to.eql('false');
      }
    });

    it('validate RM data', async () => {
      const url =
        'http://provider2.autoroutes-trafic.fr/RennesOpenData/TP_FCD_AT.csv';
      const opts: IOptions = {
        ...defaultOptions,
        csvHeaders:
          'datetime;predefinedLocationReference;averageVehicleSpeed;travelTime;travelTimeReliability;trafficStatus',
        csvColumns:
          "Date;string|int;int;int;int;'freeFlow'|'congested'|'impossible'|'heavy'|'unknown'",
        csvDelimiter: ';',
        skipLines: 1,
        newLine: true,
      };

      // mock
      const filepath = path.join(process.cwd(), 'fixtures/TP_FCD_AT.csv');
      const resource = await fs.promises.readFile(filepath, 'utf-8');
      nock('http://provider2.autoroutes-trafic.fr')
        .get('/RennesOpenData/TP_FCD_AT.csv')
        .reply(200, resource);

      const [, payload]: [IResponse, Buffer] = (
        await download(url, opts).next()
      ).value;
      expect(payload.toString()).to.eql(resource.slice(105) + '\r\n');
    });
  });
});
