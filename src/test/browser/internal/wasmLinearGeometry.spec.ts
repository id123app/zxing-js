import { assert } from 'chai';
import {
  hasValidLinearGeometry,
  ZXingWasmResult,
} from '../../../browser/internal/wasmLinearGeometry';

/** Build a fake ZXingWasmResult-like object for hasValidLinearGeometry tests. */
function makeResult(
  format: string,
  position?: ZXingWasmResult['position'],
): ZXingWasmResult {
  return { isValid: true, text: 'x', format, position };
}

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

  it('accepts a 1D detection with aspect ratio exactly at the MIN_LINEAR_ASPECT_RATIO threshold (1.5)', () => {
    // width=150, height=100 → ratio exactly 1.5. Check is "< 1.5" → 1.5 must pass.
    const onThreshold = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 150, y: 0 },
      bottomRight: { x: 150, y: 100 },
      bottomLeft: { x: 0, y: 100 },
    };
    assert.isTrue(hasValidLinearGeometry(makeResult('Code128', onThreshold)));
  });

  it('accepts a 1D detection with corner deviation exactly at the MAX_LINEAR_CORNER_ANGLE_DEVIATION_DEG threshold (10°)', () => {
    // Construct a height vector of magnitude 100 at exactly 80° to the width
    // vector → corner deviation from 90° is exactly 10°. Check is
    // "> MAX_LINEAR_CORNER_ANGLE_DEVIATION_DEG" → 10 must pass.
    const rad = (80 * Math.PI) / 180;
    const onThreshold = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 300, y: 0 },
      bottomLeft: { x: 100 * Math.cos(rad), y: 100 * Math.sin(rad) },
      bottomRight: { x: 300 + 100 * Math.cos(rad), y: 100 * Math.sin(rad) },
    };
    assert.isTrue(hasValidLinearGeometry(makeResult('Code128', onThreshold)));
  });
});
