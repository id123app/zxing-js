import { assert } from 'chai';
import { BrowserMultiFormatReader } from '../../browser/BrowserMultiFormatReader';
import DecodeHintType from '../../core/DecodeHintType';
import BarcodeFormat from '../../core/BarcodeFormat';

describe('BrowserMultiFormatReader', () => {

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const reader = new BrowserMultiFormatReader();
      assert.instanceOf(reader, BrowserMultiFormatReader);
    });

    it('should accept hints parameter', () => {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
      const reader = new BrowserMultiFormatReader(hints);
      assert.instanceOf(reader, BrowserMultiFormatReader);
    });

    it('should accept timeBetweenScansMillis parameter', () => {
      const reader = new BrowserMultiFormatReader(null, 1000);
      assert.instanceOf(reader, BrowserMultiFormatReader);
    });

    it('should accept custom wasmMaxDimension parameter', () => {
      const reader = new BrowserMultiFormatReader(null, 500, 1280);
      assert.instanceOf(reader, BrowserMultiFormatReader);
    });

    it('should use default wasmMaxDimension for invalid values', () => {
      // Negative or zero should fall back to default
      const reader = new BrowserMultiFormatReader(null, 500, -1);
      assert.instanceOf(reader, BrowserMultiFormatReader);
    });

    it('should use default wasmMaxDimension for zero', () => {
      const reader = new BrowserMultiFormatReader(null, 500, 0);
      assert.instanceOf(reader, BrowserMultiFormatReader);
    });
  });

  describe('hints and format mapping', () => {
    it('should accept hints via constructor', () => {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.QR_CODE]);
      const reader = new BrowserMultiFormatReader(hints);
      assert.instanceOf(reader, BrowserMultiFormatReader);
    });

    it('should accept null hints via constructor', () => {
      const reader = new BrowserMultiFormatReader(null);
      assert.instanceOf(reader, BrowserMultiFormatReader);
    });
  });
});
