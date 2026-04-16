import { assert } from 'chai';
import { EncoderUtils } from '../../../../core/datamatrix/encoder/EncoderUtils';
import {
  ASCII_ENCODATION,
  BASE256_ENCODATION,
  C40_ENCODATION,
  TEXT_ENCODATION,
  X12_ENCODATION,
  EDIFACT_ENCODATION,
} from '../../../../core/datamatrix/encoder/constants';

describe('EncoderUtils', () => {

  describe('isDigit', () => {
    it('should return true for digit characters 0-9', () => {
      for (let i = 0; i <= 9; i++) {
        assert.isTrue(EncoderUtils.isDigit(String(i).charCodeAt(0)), `Expected '${i}' to be a digit`);
      }
    });

    it('should return false for non-digit characters', () => {
      assert.isFalse(EncoderUtils.isDigit('A'.charCodeAt(0)));
      assert.isFalse(EncoderUtils.isDigit(' '.charCodeAt(0)));
      assert.isFalse(EncoderUtils.isDigit('/'.charCodeAt(0)));
      assert.isFalse(EncoderUtils.isDigit(':'.charCodeAt(0)));
    });
  });

  describe('isExtendedASCII', () => {
    it('should return true for characters 128-255', () => {
      assert.isTrue(EncoderUtils.isExtendedASCII(128));
      assert.isTrue(EncoderUtils.isExtendedASCII(200));
      assert.isTrue(EncoderUtils.isExtendedASCII(255));
    });

    it('should return false for characters outside 128-255', () => {
      assert.isFalse(EncoderUtils.isExtendedASCII(0));
      assert.isFalse(EncoderUtils.isExtendedASCII(127));
    });
  });

  describe('isNativeC40', () => {
    it('should return true for space, digits, and uppercase letters', () => {
      assert.isTrue(EncoderUtils.isNativeC40(' '.charCodeAt(0)));
      assert.isTrue(EncoderUtils.isNativeC40('0'.charCodeAt(0)));
      assert.isTrue(EncoderUtils.isNativeC40('9'.charCodeAt(0)));
      assert.isTrue(EncoderUtils.isNativeC40('A'.charCodeAt(0)));
      assert.isTrue(EncoderUtils.isNativeC40('Z'.charCodeAt(0)));
    });

    it('should return false for lowercase letters', () => {
      assert.isFalse(EncoderUtils.isNativeC40('a'.charCodeAt(0)));
      assert.isFalse(EncoderUtils.isNativeC40('z'.charCodeAt(0)));
    });
  });

  describe('isNativeText', () => {
    it('should return true for space, digits, and lowercase letters', () => {
      assert.isTrue(EncoderUtils.isNativeText(' '.charCodeAt(0)));
      assert.isTrue(EncoderUtils.isNativeText('0'.charCodeAt(0)));
      assert.isTrue(EncoderUtils.isNativeText('a'.charCodeAt(0)));
      assert.isTrue(EncoderUtils.isNativeText('z'.charCodeAt(0)));
    });

    it('should return false for uppercase letters', () => {
      assert.isFalse(EncoderUtils.isNativeText('A'.charCodeAt(0)));
      assert.isFalse(EncoderUtils.isNativeText('Z'.charCodeAt(0)));
    });
  });

  describe('isNativeX12', () => {
    it('should return true for CR, *, >, space, digits, and uppercase letters', () => {
      assert.isTrue(EncoderUtils.isNativeX12(13)); // CR
      assert.isTrue(EncoderUtils.isNativeX12('*'.charCodeAt(0)));
      assert.isTrue(EncoderUtils.isNativeX12('>'.charCodeAt(0)));
      assert.isTrue(EncoderUtils.isNativeX12(' '.charCodeAt(0)));
      assert.isTrue(EncoderUtils.isNativeX12('A'.charCodeAt(0)));
    });

    it('should return false for lowercase and special characters', () => {
      assert.isFalse(EncoderUtils.isNativeX12('a'.charCodeAt(0)));
      assert.isFalse(EncoderUtils.isNativeX12('#'.charCodeAt(0)));
    });
  });

  describe('isNativeEDIFACT', () => {
    it('should return true for characters in range space to ^', () => {
      assert.isTrue(EncoderUtils.isNativeEDIFACT(' '.charCodeAt(0)));
      assert.isTrue(EncoderUtils.isNativeEDIFACT('A'.charCodeAt(0)));
      assert.isTrue(EncoderUtils.isNativeEDIFACT('^'.charCodeAt(0)));
    });

    it('should return false for characters outside the EDIFACT range', () => {
      assert.isFalse(EncoderUtils.isNativeEDIFACT(31)); // below space
      assert.isFalse(EncoderUtils.isNativeEDIFACT('a'.charCodeAt(0))); // above ^
    });
  });

  describe('determineConsecutiveDigitCount', () => {
    it('should count consecutive digits from startpos', () => {
      assert.equal(EncoderUtils.determineConsecutiveDigitCount('123abc', 0), 3);
      assert.equal(EncoderUtils.determineConsecutiveDigitCount('123abc', 3), 0);
      assert.equal(EncoderUtils.determineConsecutiveDigitCount('abc456def', 3), 3);
    });

    it('should return 0 for empty string', () => {
      assert.equal(EncoderUtils.determineConsecutiveDigitCount('', 0), 0);
    });

    it('should return full length for all-digit strings', () => {
      assert.equal(EncoderUtils.determineConsecutiveDigitCount('123456789', 0), 9);
    });

    it('should default startpos to 0', () => {
      assert.equal(EncoderUtils.determineConsecutiveDigitCount('123'), 3);
    });
  });

  describe('illegalCharacter', () => {
    it('should throw an error with hex representation', () => {
      assert.throws(() => EncoderUtils.illegalCharacter('\u00FF'), /Illegal character/);
      assert.throws(() => EncoderUtils.illegalCharacter('\u00FF'), /00ff/);
    });
  });

  describe('lookAheadTest', () => {
    it('should return ASCII_ENCODATION for digit-only messages in ASCII mode', () => {
      const result = EncoderUtils.lookAheadTest('123456', 0, ASCII_ENCODATION);
      assert.equal(result, ASCII_ENCODATION);
    });

    it('should return current mode when startpos is at end of message', () => {
      const result = EncoderUtils.lookAheadTest('AB', 2, C40_ENCODATION);
      assert.equal(result, C40_ENCODATION);
    });

    it('should handle uppercase-only strings (C40 or X12 favorable)', () => {
      const result = EncoderUtils.lookAheadTest('ABCDEFGHIJKLMNOP', 0, ASCII_ENCODATION);
      assert.oneOf(result, [C40_ENCODATION, X12_ENCODATION]);
    });

    it('should handle extended ASCII characters', () => {
      const extAscii = String.fromCharCode(200, 201, 202, 203, 204, 205);
      const result = EncoderUtils.lookAheadTest(extAscii, 0, ASCII_ENCODATION);
      assert.isNumber(result);
    });
  });
});
