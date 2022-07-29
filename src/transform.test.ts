import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { stripLines, endsWith } from './transform';

const b = (s: string) => Buffer.from(s);

describe('transform', function transformTest() {
  this.slow(5);

  describe('stripLines', () => {
    it('empty string', () =>
      expect(stripLines(b(''), 1).toString()).to.equal(''));
    it('no LF', () =>
      expect(stripLines(b('foobar'), 1).toString()).to.equal(''));
    it('LF', () =>
      expect(stripLines(b('foobar\n '), 1).toString()).to.equal(' '));
    it('LF LF', () =>
      expect(stripLines(b('foobar\n\n'), 1).toString()).to.equal('\n'));
    it('CRLF', () =>
      expect(stripLines(b('foo\r\nbar'), 1).toString()).to.equal('bar'));
    it('CRLF CRLF', () =>
      expect(stripLines(b('foobar\r\n\r\n'), 1).toString()).to.equal('\r\n'));
    it('strip 3', () =>
      expect(
        stripLines(b('foo\nbar\nbaz\nbeep\nboop\nbaap'), 3).toString()
      ).to.equal('beep\nboop\nbaap'));
    it('strip more than there is', () =>
      expect(stripLines(b('foo\nbar'), 4).toString()).to.equal(''));
  });

  describe('endsWith', () => {
    it('lf', () => expect(endsWith(Buffer.from('hello\n'), '\n')).to.be.true);
    it('crlf', () =>
      expect(endsWith(Buffer.from('hello\r\n'), '\r\n')).to.be.true);
    it('empty', () => expect(endsWith(Buffer.from('hello'), '')).to.be.true);
    it('falsy', () => expect(endsWith(Buffer.from('hello'), '\n')).to.be.false);
    it('big file', () =>
      expect(
        endsWith(
          fs.readFileSync(path.join(process.cwd(), 'fixtures/TP_FCD_AT.csv')),
          '\n'
        )
      ).to.be.false);
  });
});
