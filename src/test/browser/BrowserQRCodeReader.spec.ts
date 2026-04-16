import { assert } from 'chai';
import { BrowserQRCodeReader } from '../../browser/BrowserQRCodeReader';

describe('BrowserQRCodeReader', () => {

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const reader = new BrowserQRCodeReader();
      assert.instanceOf(reader, BrowserQRCodeReader);
    });

    it('should accept number parameter (timeBetweenScansMillis)', () => {
      const reader = new BrowserQRCodeReader(1000);
      assert.instanceOf(reader, BrowserQRCodeReader);
    });

    it('should accept options object', () => {
      const reader = new BrowserQRCodeReader({
        timeBetweenScansMillis: 200,
        useWasm: false,
      });
      assert.instanceOf(reader, BrowserQRCodeReader);
    });

    it('should accept options with useWasm explicitly set to true', () => {
      const reader = new BrowserQRCodeReader({ useWasm: true });
      assert.instanceOf(reader, BrowserQRCodeReader);
    });
  });

  describe('injectWasmReader', () => {
    afterEach(() => {
      BrowserQRCodeReader.resetWasm();
    });

    it('should accept a valid module with readBarcodes function', () => {
      const fakeModule = { readBarcodes: () => [] };
      assert.doesNotThrow(() => BrowserQRCodeReader.injectWasmReader(fakeModule));
    });

    it('should throw if module is null', () => {
      assert.throws(() => BrowserQRCodeReader.injectWasmReader(null as any), /module parameter is required/);
    });

    it('should throw if module is undefined', () => {
      assert.throws(() => BrowserQRCodeReader.injectWasmReader(undefined as any), /module parameter is required/);
    });

    it('should throw if readBarcodes is not a function', () => {
      const badModule = { readBarcodes: 'not a function' } as any;
      assert.throws(() => BrowserQRCodeReader.injectWasmReader(badModule), /must be a function/);
    });

    it('should throw if readBarcodes is missing', () => {
      const emptyModule = {} as any;
      assert.throws(() => BrowserQRCodeReader.injectWasmReader(emptyModule), /must be a function/);
    });
  });

  describe('resetWasm', () => {
    afterEach(() => {
      BrowserQRCodeReader.resetWasm();
    });

    it('should allow re-injection after reset', () => {
      const module1 = { readBarcodes: () => [] };
      const module2 = { readBarcodes: () => [] };
      BrowserQRCodeReader.injectWasmReader(module1);
      BrowserQRCodeReader.resetWasm();
      assert.doesNotThrow(() => BrowserQRCodeReader.injectWasmReader(module2));
    });
  });

  describe('isWasmAvailable', () => {
    it('should return a boolean', () => {
      const result = BrowserQRCodeReader.isWasmAvailable();
      assert.isBoolean(result);
    });
  });

});
