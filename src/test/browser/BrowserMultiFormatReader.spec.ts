import { assert } from 'chai';
import { BrowserMultiFormatReader } from '../../browser/BrowserMultiFormatReader';
import { hasValidLinearGeometry } from '../../browser/internal/wasmLinearGeometry';
import DecodeHintType from '../../core/DecodeHintType';
import BarcodeFormat from '../../core/BarcodeFormat';

/** Build a fake ZXingWasmResult-like object for hasValidLinearGeometry tests. */
function makeResult(
  format: string,
  position?: {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
  } | undefined,
): any {
  return { isValid: true, text: 'x', format, position };
}

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

  describe('hasValidLinearGeometry', () => {
    it('accepts 2D formats unconditionally', () => {
      assert.isTrue(hasValidLinearGeometry(makeResult('QRCode')));
      assert.isTrue(hasValidLinearGeometry(makeResult('DataMatrix')));
      assert.isTrue(hasValidLinearGeometry(makeResult('Aztec')));
      assert.isTrue(hasValidLinearGeometry(makeResult('PDF417')));
    });

    it('accepts 2D formats with arbitrary square position data', () => {
      const square = {
        topLeft: { x: 0, y: 0 },
        topRight: { x: 100, y: 0 },
        bottomRight: { x: 100, y: 100 },
        bottomLeft: { x: 0, y: 100 },
      };
      assert.isTrue(hasValidLinearGeometry(makeResult('QRCode', square)));
    });

    it('accepts 1D format with no position data (cannot validate)', () => {
      assert.isTrue(hasValidLinearGeometry(makeResult('Code128')));
    });

    it('accepts an elongated near-rectangular landscape 1D detection', () => {
      const landscape = {
        topLeft: { x: 10, y: 50 },
        topRight: { x: 310, y: 50 },
        bottomRight: { x: 310, y: 110 },
        bottomLeft: { x: 10, y: 110 },
      };
      // width=300, height=60 → ratio 5 (passes), corner 90° (passes)
      assert.isTrue(hasValidLinearGeometry(makeResult('Code128', landscape)));
    });

    it('accepts an elongated 1D detection rotated 90 degrees (portrait orientation)', () => {
      const portrait = {
        topLeft: { x: 100, y: 10 },
        topRight: { x: 160, y: 10 },
        bottomRight: { x: 160, y: 310 },
        bottomLeft: { x: 100, y: 310 },
      };
      // width=60, height=300 → orientation-independent ratio 5 (passes), corner 90° (passes)
      assert.isTrue(hasValidLinearGeometry(makeResult('Code128', portrait)));
    });

    it('rejects a near-square 1D detection', () => {
      const square = {
        topLeft: { x: 0, y: 0 },
        topRight: { x: 100, y: 0 },
        bottomRight: { x: 100, y: 100 },
        bottomLeft: { x: 0, y: 100 },
      };
      // 100x100 → ratio 1 (fails MIN_LINEAR_ASPECT_RATIO of 1.5)
      assert.isFalse(hasValidLinearGeometry(makeResult('DataBar', square)));
    });

    it('rejects a borderline 1D detection just below the aspect threshold', () => {
      const borderline = {
        topLeft: { x: 0, y: 0 },
        topRight: { x: 140, y: 0 },
        bottomRight: { x: 140, y: 100 },
        bottomLeft: { x: 0, y: 100 },
      };
      // 140x100 → ratio 1.4 (below 1.5)
      assert.isFalse(hasValidLinearGeometry(makeResult('DataBarExpanded', borderline)));
    });

    it('rejects a heavily skewed parallelogram even with high aspect ratio', () => {
      // Long but heavily sheared: topLeft corner angle ~ 45° (deviation 45°)
      const skewed = {
        topLeft: { x: 0, y: 0 },
        topRight: { x: 300, y: 0 },
        bottomRight: { x: 400, y: 100 },
        bottomLeft: { x: 100, y: 100 },
      };
      // width=300, height=√(100²+100²)≈141.4, ratio≈2.12 (passes), but corner≈45° (fails)
      assert.isFalse(hasValidLinearGeometry(makeResult('Code128', skewed)));
    });

    it('rejects 1D result with degenerate (zero-area) position', () => {
      const degenerate = {
        topLeft: { x: 50, y: 50 },
        topRight: { x: 50, y: 50 },
        bottomRight: { x: 50, y: 50 },
        bottomLeft: { x: 50, y: 50 },
      };
      assert.isFalse(hasValidLinearGeometry(makeResult('Code128', degenerate)));
    });

    it('rejects 1D result with non-finite position coordinates', () => {
      const nonFinite = {
        topLeft: { x: 0, y: 0 },
        topRight: { x: NaN, y: 0 },
        bottomRight: { x: NaN, y: 100 },
        bottomLeft: { x: 0, y: 100 },
      };
      assert.isFalse(hasValidLinearGeometry(makeResult('EAN-13', nonFinite)));
    });

    it('rejects 1D result with position object missing required corners', () => {
      // position present but missing topRight — malformed data should not
      // be silently bypassed for a linear format
      const partial: any = {
        topLeft: { x: 0, y: 0 },
        bottomRight: { x: 100, y: 100 },
        bottomLeft: { x: 0, y: 100 },
      };
      assert.isFalse(hasValidLinearGeometry(makeResult('Code128', partial)));
    });

    it('accepts a 1D detection with mild camera-perspective tilt', () => {
      // Long horizontal box, bottom row shifted right by 8 of 100 height → corner
      // angle ≈ acos(8/√(8²+100²)) ≈ 85.4°, deviation ≈ 4.6° (within 10° tolerance)
      const tilted = {
        topLeft: { x: 0, y: 0 },
        topRight: { x: 300, y: 0 },
        bottomLeft: { x: 8, y: 100 },
        bottomRight: { x: 308, y: 100 },
      };
      assert.isTrue(hasValidLinearGeometry(makeResult('Code128', tilted)));
    });
  });
});
