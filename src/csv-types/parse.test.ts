import { parse } from './index';
import { expect } from 'chai';

describe('csv types', () => {
  describe('primitives', () => {
    it('Date', () => {
      const result = parse('Date');
      expect(result).to.eql([{ type: 'Date' }]);
    });
  
    it('string', () => {
      const result = parse('string');
      expect(result).to.eql([{ type: 'string' }]);
    });
  
    it('int', () => {
      const result = parse('int');
      expect(result).to.eql([{ type: 'int' }]);
    });
  
    it('float', () => {
      const result = parse('float');
      expect(result).to.eql([{ type: 'float' }]);
    });
  
    it('bool', () => {
      const result = parse('bool');
      expect(result).to.eql([{ type: 'bool' }]);
    });
  
    it('empty', () => {
      const result = parse('empty');
      expect(result).to.eql([{ type: 'empty' }]);
    });

    it('constant', () => {
      const result = parse("'hello'");
      expect(result).to.eql([{ type: 'constant', value: 'hello' }]);
    });

    it('unknown', () => {
      expect(() => parse("unknwon")).to.throw;
    });
  });
});