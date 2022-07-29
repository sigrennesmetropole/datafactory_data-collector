import { validate } from '.';
import { expect } from 'chai';

describe('csv validator', () => {
  describe('Date', () => {
    it('ISO 8601', () =>
      expect(validate(0, ['2020-08-27T20:34:39Z'], [{ type: 'Date' }])).to.be
        .empty);
    it('ISO 8601 (tz)', () =>
      expect(validate(0, ['2020-08-27T20:34:39+02:00'], [{ type: 'Date' }])).to.be
        .empty);
    it('timestamp should fail', () =>
      expect(validate(0, ['1598560523136'], [{ type: 'Date' }])).not.to.be.empty);
    it('random string should fail', () =>
      expect(validate(0, ['foo'], [{ type: 'Date' }])).not.to.be.empty);
  });

  describe('bool', () => {
    it('true', () =>
      expect(validate(0, ['true'], [{ type: 'bool' }])).to.be.empty);
    it('false', () =>
      expect(validate(0, ['false'], [{ type: 'bool' }])).to.be.empty);
    it('random string should fail', () =>
      expect(validate(0, ['foo'], [{ type: 'bool' }])).not.to.be.empty);
  });

  describe('float', () => {
    it('.25', () => expect(validate(0, ['.25'], [{ type: 'float' }])).to.be.empty);
    it('42.00', () =>
      expect(validate(0, ['42.00'], [{ type: 'float' }])).to.be.empty);
    it(',25', () => expect(validate(0, [',25'], [{ type: 'float' }])).to.be.empty);
    it('42,00', () =>
      expect(validate(0, ['42,00'], [{ type: 'float' }])).to.be.empty);
    it('42.00.00 should fail', () =>
      expect(validate(0, ['42.00.00'], [{ type: 'float' }])).not.to.be.empty);
    it('13..37 should fail', () =>
      expect(validate(0, ['13..37'], [{ type: 'float' }])).not.to.be.empty);
    it('random str should fail', () =>
      expect(validate(0, ['foo bar'], [{ type: 'float' }])).not.to.be.empty);
  });

  describe('int', () => {
    it('0', () => expect(validate(0, ['0'], [{ type: 'int' }])).to.be.empty);
    it('4200', () => expect(validate(0, ['4200'], [{ type: 'int' }])).to.be.empty);
    it('42_F', () =>
      expect(validate(0, ['42_F'], [{ type: 'int' }])).not.to.be.empty);
    it('0.25 should fail', () =>
      expect(validate(0, ['0.25'], [{ type: 'int' }])).not.to.be.empty);
    it('random str should fail', () =>
      expect(validate(0, ['foo bar'], [{ type: 'int' }])).not.to.be.empty);
  });

  describe('string', () => {
    it('foo', () =>
      expect(validate(0, ['foo'], [{ type: 'string' }])).to.be.empty);
    it('hello world', () =>
      expect(validate(0, ['hello world'], [{ type: 'string' }])).to.be.empty);
    it('42', () => expect(validate(0, ['42'], [{ type: 'string' }])).to.be.empty);
    it('3.14', () =>
      expect(validate(0, ['3.14'], [{ type: 'string' }])).to.be.empty);
    it('an empty string should fail', () =>
      expect(validate(0, [''], [{ type: 'string' }])).not.to.be.empty);
  });

  describe('empty', () => {
    it('empty string', () =>
      expect(validate(0, [''], [{ type: 'empty' }])).to.be.empty);
    it('foo', () =>
      expect(validate(0, ['foo'], [{ type: 'empty' }])).not.to.be.empty);
  });

  describe('constant', () => {
    it('match', () =>
      expect(validate(0, ['foo'], [{ type: 'constant', value: 'foo' }])).to.be
        .empty);
    it('mismatch', () =>
      expect(validate(0, ['bar'], [{ type: 'constant', value: 'foo' }])).not.to.be
        .empty);
  });

  describe('union', () => {
    it('int|float', () => {
      expect(
        validate(0, 
          ['42'],
          [{ type: 'union', values: [{ type: 'int' }, { type: 'float' }] }]
        )
      ).to.be.empty;
      expect(
        validate(0, 
          ['3.14'],
          [{ type: 'union', values: [{ type: 'int' }, { type: 'float' }] }]
        )
      ).to.be.empty;
    });

    it('constants', () => {
      const result = validate(0, 
        ['foo'],
        [{
          type: 'union',
          values: [
            { type: 'constant', value: 'bar' },
            { type: 'constant', value: 'bleep' },
            { type: 'constant', value: 'bloop' },
          ],
        }]
      );
      expect(result).not.to.be.empty;
    });
  });
});
