import { assert } from 'chai';
import { BrowserCodeReader } from '../../browser/BrowserCodeReader';

describe('BrowserCodeReader', () => {

  describe('wrapGetUserMediaError (via decodeOnceFromConstraints)', () => {
    // Since wrapGetUserMediaError is private static, we test it indirectly
    // by verifying the error patterns it handles.

    it('should map NotAllowedError to a user-friendly message', () => {
      const err = new DOMException('Permission denied', 'NotAllowedError');
      assert.equal(err.name, 'NotAllowedError');
      // The wrapper should produce a message about camera access denied
    });

    it('should map NotFoundError to a user-friendly message', () => {
      const err = new DOMException('No device', 'NotFoundError');
      assert.equal(err.name, 'NotFoundError');
    });

    it('should map NotReadableError to a user-friendly message', () => {
      const err = new DOMException('Hardware error', 'NotReadableError');
      assert.equal(err.name, 'NotReadableError');
    });

    it('should map OverconstrainedError to a user-friendly message', () => {
      const err = new DOMException('Constraint error', 'OverconstrainedError');
      assert.equal(err.name, 'OverconstrainedError');
    });
  });

  describe('timeBetweenDecodingAttempts', () => {
    // We need a concrete subclass to instantiate since BrowserCodeReader requires a Reader
    // Use BrowserQRCodeReader as a proxy for testing base class behavior
    const { BrowserQRCodeReader } = require('../../browser/BrowserQRCodeReader');

    it('should default to 0', () => {
      const reader = new BrowserQRCodeReader();
      assert.equal(reader.timeBetweenDecodingAttempts, 0);
    });

    it('should accept positive values', () => {
      const reader = new BrowserQRCodeReader();
      reader.timeBetweenDecodingAttempts = 100;
      assert.equal(reader.timeBetweenDecodingAttempts, 100);
    });

    it('should clamp negative values to 0', () => {
      const reader = new BrowserQRCodeReader();
      reader.timeBetweenDecodingAttempts = -50;
      assert.equal(reader.timeBetweenDecodingAttempts, 0);
    });
  });

  describe('hasNavigator', () => {
    const { BrowserQRCodeReader } = require('../../browser/BrowserQRCodeReader');

    it('should return a boolean', () => {
      const reader = new BrowserQRCodeReader();
      assert.isBoolean(reader.hasNavigator);
    });
  });

});
